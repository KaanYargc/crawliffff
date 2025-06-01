import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByEmail, validatePassword } from '@/lib/supabase';
import DB from '@/lib/db';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email ve şifre gerekli');
        }

        // First try to get user from database directly, bypassing any caching
        try {
          // Initialize DB if needed
          DB.init();
          
          // Get user directly from SQLite database
          const dbUser = await DB.get(
            'SELECT * FROM users WHERE email = ?', 
            [credentials.email]
          );
          
          if (dbUser) {
            console.log('User found directly in DB:', {
              id: dbUser.id,
              email: dbUser.email,
              role: dbUser.role,
              package: dbUser.package,
              first_login: dbUser.first_login === 1 ? true : false
            });
            
            // Validate password
            const isPasswordValid = await validatePassword(dbUser, credentials.password);
            
            if (isPasswordValid) {
              return {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
                package: dbUser.package,
                // Convert SQLite integer to boolean
                first_login: dbUser.first_login === 1
              };
            }
          }
        } catch (dbError) {
          console.error('Error querying database directly:', dbError);
          // Fall through to Supabase auth if DB query fails
        }

        // Check for similar email addresses to provide better error messages
        try {
          // Find similar emails in the database (simple check for now)
          const similarUsers = await DB.all(
            "SELECT email FROM users WHERE email LIKE ?", 
            [`%${credentials.email.split('@')[0].substring(0, 5)}%@%`]
          );
          
          if (similarUsers && similarUsers.length > 0) {
            console.log('Found similar emails:', similarUsers.map(u => u.email));
            throw new Error(`Kullanıcı bulunamadı. Belki ${similarUsers[0].email} e-postasını kullanmak istemiş olabilirsiniz?`);
          }
        } catch (similarError) {
          console.error('Error checking for similar emails:', similarError);
          // Continue with normal flow if this fails
        }

        // Fallback to Supabase authentication
        const user = await findUserByEmail(credentials.email);

        if (!user) {
          console.log('User not found:', credentials.email);
          throw new Error('Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı. Lütfen e-posta adresinizi kontrol edin.');
        }

        const isPasswordValid = await validatePassword(user, credentials.password);

        if (!isPasswordValid) {
          console.log('Invalid password for user:', credentials.email);
          throw new Error('Geçersiz şifre. Lütfen şifrenizi kontrol edin.');
        }

        // Log user details without sensitive data
        console.log('User authenticated successfully:', {
          id: user.id,
          email: user.email,
          role: user.role,
          package: user.package,
          first_login: user.first_login
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          package: user.package,
          first_login: user.first_login
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      console.log('JWT callback called with trigger:', trigger);
      
      if (user) {
        // Initial sign in - set token values from user
        console.log('Setting initial JWT from user data:', { 
          id: user.id, 
          role: user.role, 
          package: user.package, 
          first_login: user.first_login
        });
        token.role = user.role;
        token.id = user.id;
        token.package = user.package;
        token.first_login = user.first_login;
      } else if (trigger === 'update' && session) {
        // Session update via session.update()
        console.log('Updating JWT from session:', session);
        // Only update fields that are present in the update
        if (session.user?.package !== undefined) {
          token.package = session.user.package;
          console.log('Updated token package to:', token.package);
        }
        
        if (session.user?.first_login !== undefined) {
          token.first_login = session.user.first_login;
          console.log('Updated token first_login to:', token.first_login);
        }
      } else {
        // On subsequent requests, refresh user data from database
        try {
          // Use the email in the token to get fresh user data
          if (token.email) {
            // Initialize DB if needed
            DB.init();
            
            // Get latest user data
            const dbUser = await DB.get(
              'SELECT * FROM users WHERE email = ?', 
              [token.email]
            );
            
            if (dbUser) {
              console.log('Refreshed user data from DB:', {
                id: dbUser.id,
                email: dbUser.email,
                role: dbUser.role,
                package: dbUser.package,
                first_login: dbUser.first_login === 1 ? true : false
              });
              
              // Update token with latest values
              token.role = dbUser.role;
              token.package = dbUser.package;
              token.first_login = dbUser.first_login === 1 ? true : false;
              
              console.log('Updated token with fresh data from DB');
            }
          }
        } catch (dbError) {
          console.error('Error refreshing user data from DB:', dbError);
          // Continue with existing token data if refresh fails
        }
      }
      
      // Debugging the final token state
      console.log('Final JWT token values:', {
        id: token.id,
        role: token.role,
        package: token.package,
        first_login: token.first_login
      });
      
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        console.log('Building session from token:', {
          id: token.id,
          role: token.role,
          package: token.package,
          first_login: token.first_login
        });
        
        // Transfer values from token to session
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.package = token.package as string;
        session.user.first_login = token.first_login as boolean;
      }
      
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: false, // Disable debug mode
  secret: process.env.NEXTAUTH_SECRET || 'crawlify-nextauth-secret',
});

export { handler as GET, handler as POST };