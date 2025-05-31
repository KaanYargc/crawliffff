import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByEmail, validatePassword, initDb } from '@/lib/db';

// Initialize the database when the auth route is first loaded
try {
  initDb();
} catch (error) {
  console.error('Failed to initialize database:', error);
}

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
          return null;
        }

        // Find user by email
        const user = findUserByEmail(credentials.email);
        
        if (!user || !user.id) {
          return null;
        }

        // Validate password
        const isValidPassword = await validatePassword(user, credentials.password);
        
        if (!isValidPassword) {
          return null;
        }

        // Return user object without password
        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add role to JWT token when user signs in
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add role to session
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'crawlify-nextauth-secret',
});

export { handler as GET, handler as POST };