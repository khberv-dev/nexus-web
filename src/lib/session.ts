import type {Session} from "next-auth";
import {getServerSession} from "next-auth";
import {authConfig} from "@/lib/auth/config";
import {prisma} from "@/lib/db/prisma";
import {Role} from "@prisma/client";
import {isDevAuthBypass, resolveDevMockDbUser} from "@/lib/dev-auth";
import {formatUserName} from "@/lib/user-name";

export type SessionUser = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone?: string | null;
    role: string;
};

/** User in DB by session id; archived users are treated as unavailable. */
export async function getSessionDbUser(user: SessionUser) {
    return prisma.user.findFirst({where: {id: user.id, archivedAt: null}});
}

export async function getOrCreateDbUser(session: SessionUser) {
    const byId = await prisma.user.findUnique({where: {id: session.id}});
    if (byId) {
        if (session.phone) {
            await prisma.user.update({
                where: {id: byId.id},
                data: {phone: session.phone},
            });
        }
        return byId;
    }
    return prisma.user.upsert({
        where: {email: session.email},
        update: {
            phone: session.phone ?? undefined,
        },
        create: {
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            phone: session.phone ?? undefined,
            role: session.role as Role,
            zitadelId: null,
        },
    });
}

/** next-auth session; in dev DEV_AUTH_BYPASS returns the seeded DB user. */
export async function getServerSessionWithDevBypass(): Promise<Session | null> {
    if (isDevAuthBypass()) {
        const row = await resolveDevMockDbUser();
        if (!row || row.archivedAt) return null;
        return {
            expires: new Date(Date.now() + 7 * 864e5).toISOString(),
            user: {
                id: row.id,
                email: row.email ?? "dev@local",
                name: formatUserName(row),
                image: row.image,
                role: row.role,
                zitadelSub: row.zitadelId ?? null,
                phone: row.phone,
            },
        } as Session;
    }

    const session = await getServerSession(authConfig);
    const u = session?.user;
    if (!u?.id) return session;

    // Enforce account archival + admin session revocation, mirroring getSessionUser.
    // Without this, routes using this helper keep serving archived/revoked users
    // until their JWT expires (revoke-session/archive would have no effect there).
    const dbUser = await prisma.user.findUnique({
        where: {id: u.id},
        select: {archivedAt: true, sessionVersion: true},
    });
    if (!dbUser || dbUser.archivedAt) return null;
    if (u.sessionVersion !== undefined && dbUser.sessionVersion !== u.sessionVersion) return null;

    return session;
}

export async function getSessionUser(): Promise<SessionUser | null> {
    if (isDevAuthBypass()) {
        const row = await resolveDevMockDbUser();
        if (!row || row.archivedAt) {
            console.warn("[dev-auth] DEV_AUTH_BYPASS: no active user found");
            return null;
        }
        return {
            id: row.id,
            email: row.email ?? "dev@local",
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            role: row.role,
        };
    }

    const session = await getServerSession(authConfig);
    const u = session?.user;
    if (!u?.id || !u.role) return null;

    const dbUser = await prisma.user.findUnique({
        where: {id: u.id},
        select: {
            id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
            archivedAt: true, sessionVersion: true,
        },
    });
    if (!dbUser || dbUser.archivedAt) return null;

    // Принудительный инвалид сессии: если sessionVersion в токене не совпадает с БД —
    // пользователь был разлогинен администратором.
    if (u.sessionVersion !== undefined && dbUser.sessionVersion !== u.sessionVersion) return null;

    return {
        id: dbUser.id,
        email: dbUser.email ?? u.email ?? "",
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        phone: dbUser.phone ?? u.phone ?? null,
        role: dbUser.role,
    };
}
