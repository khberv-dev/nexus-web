import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role, OnboardingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Прямая регистрация клиента/специалиста: email + пароль, без magic-link письма и без
 * обязательного телефона. Аккаунт создаётся сразу активным — фронт логинится через
 * signIn("credentials", ...) сразу после успешного ответа этого роута.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: string;
    password?: string;
    role?: string;
    name?: string;
    phone?: string;
    formData?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` },
      { status: 400 }
    );
  }

  const role = body.role as Role;
  if (role !== Role.CLIENT && role !== Role.SPECIALIST) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "Вы уже зарегистрированы. Войдите в систему.", code: "ALREADY_REGISTERED" },
      { status: 409 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const rawFormData =
    body.formData != null && typeof body.formData === "object"
      ? (body.formData as Record<string, unknown>)
      : {};
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      name,
      phone,
      role,
      password: passwordHash,
      ...(role === Role.CLIENT
        ? {
            clientProfile: {
              create: {
                formData: {
                  ...rawFormData,
                  fullName: name ?? "",
                  email,
                } as Prisma.InputJsonValue,
              },
            },
          }
        : {
            specialistProfile: {
              create: {
                onboardingStatus: OnboardingStatus.PENDING,
                formData: rawFormData as Prisma.InputJsonValue,
              },
            },
          }),
    },
  });

  return NextResponse.json({ ok: true });
}
