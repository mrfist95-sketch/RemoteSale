import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    sv?: number;
    revoked?: boolean;
  }
}
