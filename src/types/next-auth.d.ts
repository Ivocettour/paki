import type { UserRole, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role: UserRole;
    status: UserStatus;
    firstName: string;
    lastName: string;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      firstName: string;
      lastName: string;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` solo reexporta `@auth/core/jwt`, y un `export *` no admite
// fusión de interfaces: hay que augmentar el módulo de origen.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
    firstName: string;
    lastName: string;
  }
}

export {};
