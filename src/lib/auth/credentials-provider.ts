import CredentialsProvider from "next-auth/providers/credentials";
import {prisma} from "@/lib/db/prisma";
import {verifyPassword} from "./password";

/** Email + пароль. Работает только для User с уже установленным password (см. prisma/seed.ts). */
export function credentialsProvider() {
    return CredentialsProvider({
        id: "credentials",
        name: "Email and password",
        credentials: {
            email: {label: "Email", type: "email"},
            password: {label: "Password", type: "password"},
        },
        async authorize(credentials) {
            const email = credentials?.email?.trim().toLowerCase();
            const password = credentials?.password;
            if (!email || !password) return null;

            // Global Prisma client omits `password` by default (see src/lib/db/prisma.ts) — opt back in here.
            const user = await prisma.user.findUnique({where: {email}, omit: {password: false}});
            if (!user || !user.password || user.archivedAt) return null;

            const valid = await verifyPassword(password, user.password);
            if (!valid) return null;

            return {id: user.id, email: user.email, name: user.name, role: user.role};
        },
    });
}
