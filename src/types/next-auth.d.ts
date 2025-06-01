import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      package: string;
      first_login: boolean;
    };
  }
  
  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    package: string;
    first_login: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    id?: string | number;
  }
}