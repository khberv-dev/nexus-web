import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma, Role } from "@prisma/client";

const TTL_MS = 24 * 60 * 60 * 1000;

/** Проверяет, есть ли аккаунт с таким email (User или активная заявка PendingSignup). */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ exists: false });
  }
  const [user, pending] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.pendingSignup.findUnique({ where: { email }, select: { email: true } }),
  ]);
  return NextResponse.json({ exists: !!(user || pending) });
}

/** Сохраняет желаемую роль/имя до перехода по ссылке из письма (только для недавно созданных аккаунтов, см. jwt callback). */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: string;
    role?: string;
    name?: string;
    formData?: unknown;
  };
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailRaw || !emailRaw.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const role = body.role as Role;
  if (role !== "CLIENT" && role !== "SPECIALIST") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: emailRaw },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error: "Вы уже зарегистрированы. Войдите в систему.",
        code: "ALREADY_REGISTERED",
      },
      { status: 409 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() || null : null;
  let formData: Prisma.InputJsonValue | undefined;
  // Важное правило: для специалистов телефон обязателен уже на этапе pending-signup,
  // потому что этот путь может обойти /api/onboarding/apply (и создать User с phone = null).
  if (role === "SPECIALIST") {
    if (body.formData === undefined || body.formData === null || typeof body.formData !== "object") {
      return NextResponse.json(
        { error: "Укажите телефон (через форму регистрации)." },
        { status: 400 }
      );
    }
    const raw = body.formData as Record<string, unknown>;
    const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
    if (!phone) {
      return NextResponse.json({ error: "Укажите телефон." }, { status: 400 });
    }
  }

  if (body.formData !== undefined && body.formData !== null) {
    if (typeof body.formData !== "object") {
      return NextResponse.json({ error: "Invalid formData" }, { status: 400 });
    }
    formData = body.formData as Prisma.InputJsonValue;
  }

  await prisma.pendingSignup.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - TTL_MS) } },
  });

  await prisma.pendingSignup.upsert({
    where: { email: emailRaw },
    create: {
      email: emailRaw,
      role,
      name,
      ...(formData !== undefined ? { formData } : {}),
    },
    update: {
      role,
      name,
      createdAt: new Date(),
      ...(formData !== undefined ? { formData } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
