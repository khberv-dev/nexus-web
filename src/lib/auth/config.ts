import type { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { Prisma, Role } from "@prisma/client";
import { resendEmailProvider } from "./email-provider";
import { zitadelProvider } from "./providers";

const PENDING_ROLE_WINDOW_MS = 30 * 60 * 1000; // 30 минут — достаточно для корпоративных почт

async function applyPendingSignup(userId: string, emailNorm: string) {
  const db = await prisma.user.findUnique({ where: { id: userId } });
  if (!db) return;

  const pending = await prisma.pendingSignup.findUnique({ where: { email: emailNorm } });
  if (!pending) return;

  const ageMs = Date.now() - db.createdAt.getTime();
  const data: { role?: Role; name?: string } = {};
  if (ageMs < PENDING_ROLE_WINDOW_MS) {
    data.role = pending.role;
    if (pending.name?.trim()) data.name = pending.name.trim();
  }
  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }

  if (ageMs < PENDING_ROLE_WINDOW_MS && pending.role === "CLIENT" && pending.formData != null) {
    const raw = pending.formData as Record<string, unknown>;
    const phone = typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null;
    if (phone) {
      await prisma.user.update({ where: { id: userId }, data: { phone } });
    }
    const fullNameFromRaw =
      typeof raw.fullName === "string" && raw.fullName.trim() ? raw.fullName.trim() : pending.name?.trim() ?? "";
    const emailFromRaw = typeof raw.email === "string" && raw.email.trim() ? raw.email.trim() : emailNorm;
    const { personalDataConsentAccepted: _consent, phone: _p, email: _e, fullName: _fn, ...formDataRest } = raw;
    const profileData = {
      ...formDataRest,
      fullName: fullNameFromRaw,
      email: emailFromRaw,
    } as Prisma.InputJsonValue;
    await prisma.clientProfile.upsert({
      where: { userId },
      create: { userId, formData: profileData },
      update: { formData: profileData },
    });
  }

  if (ageMs < PENDING_ROLE_WINDOW_MS && pending.role === "SPECIALIST" && pending.formData != null) {
    const raw = pending.formData as Record<string, unknown>;
    const phone = typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null;
    const {
      phone: _p,
      email: _e,
      personalDataConsentAccepted: _consent,
      about: _about,
      ...formDataRest
    } = raw;
    if (phone) {
      await prisma.user.update({ where: { id: userId }, data: { phone } });
    }
    await prisma.specialistProfile.upsert({
      where: { userId },
      create: {
        userId,
        onboardingStatus: "PENDING",
        formData: formDataRest as Prisma.InputJsonValue,
      },
      update: { formData: formDataRest as Prisma.InputJsonValue },
    });
  }

  await prisma.pendingSignup.delete({ where: { email: emailNorm } }).catch(() => {});
}

async function ensureSpecialistProfile(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role !== "SPECIALIST") return;
  await prisma.specialistProfile.upsert({
    where: { userId },
    create: { userId, onboardingStatus: "PENDING" },
    update: {},
  });
}

type AuthProvider = NonNullable<AuthOptions["providers"]>[number];

function buildProviders(): AuthProvider[] {
  const list: AuthProvider[] = [resendEmailProvider()];
  if (
    process.env.ZITADEL_ISSUER &&
    process.env.ZITADEL_CLIENT_ID &&
    process.env.ZITADEL_PROJECT_ID
  ) {
    list.push(zitadelProvider);
  }
  return list;
}

export const authConfig: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 3600 },
  jwt: { maxAge: 3600 },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/login",
    error: "/error",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "zitadel" && profile) {
        token.zitadelSub = profile.sub as string;
        const phone = (profile as Record<string, unknown>).phone_number;
        if (typeof phone === "string" && phone.trim()) {
          token.phone = phone.trim();
        }
        const rolesKey = Object.keys(profile as Record<string, unknown>).find((k) =>
          k.match(/urn:zitadel:iam:org:project:.+:roles/)
        );
        const rolesMap = rolesKey
          ? ((profile as Record<string, unknown>)[rolesKey] as Record<string, unknown>)
          : {};
        let role: Role = Role.CLIENT;
        for (const r of ["ADMIN", "SPECIALIST", "CLIENT"] as const) {
          if (r in rolesMap) {
            role = r;
            break;
          }
        }
        token.role = role;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        if (user?.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              zitadelId: profile.sub as string,
              role,
              phone: typeof phone === "string" && phone.trim() ? phone.trim() : undefined,
            },
          });
          await ensureSpecialistProfile(user.id);
        }
      } else if (account?.provider === "email" && user?.id && user.email) {
        const emailNorm = user.email.toLowerCase().trim();
        await applyPendingSignup(user.id, emailNorm);
        await ensureSpecialistProfile(user.id);
        const db = await prisma.user.findUnique({ where: { id: user.id } });
        token.sub = user.id;
        token.email = db?.email ?? emailNorm;
        token.role = db?.role ?? Role.CLIENT;
        token.zitadelSub = db?.zitadelId ?? undefined;
        token.sessionVersion = db?.sessionVersion ?? 1;
      } else if (user?.id) {
        const db = await prisma.user.findUnique({ where: { id: user.id } });
        token.sub = user.id;
        token.email = db?.email ?? user.email ?? token.email;
        token.role = db?.role ?? (token.role as string) ?? Role.CLIENT;
        token.zitadelSub = db?.zitadelId ?? token.zitadelSub;
        token.sessionVersion = db?.sessionVersion ?? 1;
      }

      if (!token.role && token.sub) {
        const db = await prisma.user.findUnique({
          where: { id: token.sub as string },
          select: { role: true, zitadelId: true, email: true },
        });
        if (db) {
          token.role = db.role;
          token.zitadelSub = db.zitadelId ?? undefined;
          if (db.email) token.email = db.email;
        }
      }

      if (
        token.refreshToken &&
        token.expiresAt &&
        process.env.ZITADEL_ISSUER &&
        process.env.ZITADEL_CLIENT_ID &&
        Date.now() / 1000 > (token.expiresAt as number) - 60
      ) {
        try {
          const res = await fetch(`${process.env.ZITADEL_ISSUER}/oauth/v2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
              client_id: process.env.ZITADEL_CLIENT_ID!,
            }),
          });
          const refreshed = await res.json();
          if (refreshed.access_token) {
            token.accessToken = refreshed.access_token;
            token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
          }
        } catch {
          // keep old token
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        if (typeof token.email === "string") session.user.email = token.email;
        session.user.role = (token.role as string) ?? "CLIENT";
        session.user.zitadelSub = (token.zitadelSub as string | undefined) ?? null;
        session.user.phone = (token.phone as string | undefined) ?? null;
        session.user.sessionVersion = token.sessionVersion as number | undefined;
      }
      return session;
    },
  },
};
