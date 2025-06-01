import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import DB from '@/lib/db';

// Initialize database
DB.init();

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

        const user = await DB.get(
          "SELECT * FROM users WHERE email = ?",
          [credentials.email]
        );

        if (!user) {
          throw new Error('Kullanıcı bulunamadı');
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Geçersiz şifre');
        }

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
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.package = user.package;
        token.first_login = user.first_login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
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
  },
  secret: process.env.NEXTAUTH_SECRET || 'crawlify-nextauth-secret',
});

export { handler as GET, handler as POST };