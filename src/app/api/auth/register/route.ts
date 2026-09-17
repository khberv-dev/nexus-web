import {NextRequest, NextResponse} from "next/server";
import {OnboardingStatus, Prisma, Role} from "@prisma/client";
import {isValidPhoneNumber} from "react-phone-number-input";
import {prisma} from "@/lib/db/prisma";
import {hashPassword} from "@/lib/auth/password";
import {omitNameFields, parseNameParts} from "@/lib/user-name";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Прямая регистрация клиента/специалиста: email + пароль, телефон обязателен.
 * Аккаунт создаётся сразу активным — фронт логинится через
 * signIn("credentials", ...) сразу после успешного ответа этого роута.
 */
export async function POST(req: NextRequest) {
    const body = (await req.json()) as {
        email?: string;
        password?: string;
        role?: string;
        firstName?: unknown;
        lastName?: unknown;
        phone?: string;
        formData?: unknown;
    };

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
        return NextResponse.json({error: "Введите корректный email"}, {status: 400});
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
            {error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`},
            {status: 400}
        );
    }

    const role = body.role as Role;
    if (role !== Role.CLIENT && role !== Role.SPECIALIST) {
        return NextResponse.json({error: "Invalid role"}, {status: 400});
    }

    const nameParts = parseNameParts(body, {required: true});
    if ("error" in nameParts) {
        return NextResponse.json({error: nameParts.error}, {status: 400});
    }
    const {firstName, lastName} = nameParts;

    const existing = await prisma.user.findUnique({where: {email}, select: {id: true}});
    if (existing) {
        return NextResponse.json(
            {error: "Вы уже зарегистрированы. Войдите в систему.", code: "ALREADY_REGISTERED"},
            {status: 409}
        );
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone || !isValidPhoneNumber(phone)) {
        return NextResponse.json({error: "Введите корректный номер телефона"}, {status: 400});
    }
    // Имя хранится в User — из анкеты его убираем, даже если клиент прислал.
    const rawFormData = omitNameFields(
        body.formData != null && typeof body.formData === "object"
            ? (body.formData as Record<string, unknown>)
            : {},
    );
    const passwordHash = await hashPassword(password);

    await prisma.user.create({
        data: {
            email,
            firstName,
            lastName,
            phone,
            role,
            password: passwordHash,
            ...(role === Role.CLIENT
                ? {
                    clientProfile: {
                        create: {
                            formData: {
                                ...rawFormData,
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

    return NextResponse.json({ok: true});
}
