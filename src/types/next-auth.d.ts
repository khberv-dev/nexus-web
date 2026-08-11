import type {DefaultSession} from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
            role: string;
            zitadelSub?: string | null;
            phone?: string | null;
            sessionVersion?: number;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        zitadelSub?: string | null;
        phone?: string | null;
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        sessionVersion?: number;
    }
}
