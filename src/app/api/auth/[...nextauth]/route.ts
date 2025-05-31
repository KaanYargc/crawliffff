import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByEmail, validatePassword, initNetlifyAuth } from '@/lib/netlify-auth';

// Veritabanını başlat
try {
  initNetlifyAuth().then(success => {
    if (success) {
      console.log('Netlify auth sistemi başarıyla başlatıldı');
    } else {
      console.error('Netlify auth sistemi başlatılamadı');
    }
  });
} catch (error) {
  console.error('Netlify auth sistemi başlatılırken hata:', error);
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

        // Email ile kullanıcıyı bul
        const user = await findUserByEmail(credentials.email);
        
        if (!user || !user.id) {
          return null;
        }

        // Şifreyi doğrula
        const isValidPassword = await validatePassword(user, credentials.password);
        
        if (!isValidPassword) {
          return null;
        }

        // Şifre olmadan kullanıcı nesnesini döndür
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
      // Kullanıcı giriş yaptığında JWT token'a rol ekle
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Session'a rol ekle
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