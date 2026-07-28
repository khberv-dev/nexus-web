import { NextRequest, NextResponse } from "next/server"
import { encode } from "next-auth/jwt"
import { prisma } from "@/lib/db/prisma"
import type { Role } from "@prisma/client"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const DEMO_EMAILS: Record<string, string> = {
  CLIENT: "demo-client@nexuspro.ru",
  SPECIALIST: "demo-specialist@nexuspro.ru",
}

export async function POST(req: NextRequest) {
  // Blunt brute-forcing of DEMO_ACCESS_KEY.
  if (!rateLimit(`demo-login:${getClientIp(req)}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  const { key, role: rawRole } = (await req.json().catch(() => ({}))) as { key?: string; role?: string }
  if (!key || key !== process.env.DEMO_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid key" }, { status: 403 })
  }

  const role = rawRole?.toUpperCase() as Role | undefined
  if (!role || !["CLIENT", "SPECIALIST", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  // A shared demo key must never mint a REAL admin session in production. The demo
  // admin button stays usable in dev/staging (NODE_ENV !== production).
  if (role === "ADMIN" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Demo admin login is disabled in production" }, { status: 403 })
  }

  let user: { id: string; email: string; name: string | null; role: string }

  if (role === "ADMIN") {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN", archivedAt: null } })
    if (!admin?.email) return NextResponse.json({ error: "Admin not found" }, { status: 404 })
    user = { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
  } else {
    const email = DEMO_EMAILS[role]!
    const dbUser = await prisma.user.upsert({
      where: { email },
      create: { email, name: role === "CLIENT" ? "Demo Заказчик" : "Demo Специалист", role },
      update: {},
    })
    if (role === "SPECIALIST") {
      await prisma.specialistProfile.upsert({
        where: { userId: dbUser.id },
        create: { userId: dbUser.id, onboardingStatus: "PENDING" },
        update: {},
      })
    }
    if (role === "CLIENT") {
      await prisma.clientProfile.upsert({
        where: { userId: dbUser.id },
        create: { userId: dbUser.id },
        update: {},
      })
    }
    user = { id: dbUser.id, email: dbUser.email!, name: dbUser.name, role: dbUser.role }
  }

  const secret = process.env.NEXTAUTH_SECRET!
  const isSecure = process.env.NODE_ENV === "production"
  const token = await encode({
    secret,
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    maxAge: 3600,
  })

  const cookieName = isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  })
  return res
}
