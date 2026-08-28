import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {sendEmail} from "@/lib/email";
import {notify} from "@/lib/notifications";
import type {Prisma} from "@prisma/client";

export async function POST(req: NextRequest) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {role, id, zitadelSub} = session.user as { role: string; id: string; zitadelSub?: string | null };
    if (role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id},
        include: {specialistProfile: true},
    });
    if (!user?.specialistProfile) return NextResponse.json({error: "Profile not found"}, {status: 404});

    const formData = await req.json();
    const taxStatus = formData?.taxStatus;
    if (taxStatus !== "IP" && taxStatus !== "SZ" && taxStatus !== "OOO") {
        return NextResponse.json({error: "Укажите налоговый статус: ИП, самозанятый или ООО."}, {status: 400});
    }
    const phoneFromBody =
        typeof formData?.phone === "string" && formData.phone.trim() ? formData.phone.trim() : null;
    const phone = phoneFromBody ?? user.phone ?? null;
    if (!phone) {
        return NextResponse.json({error: "Укажите телефон."}, {status: 400});
    }
    const formDataWithoutPhone = {...((formData ?? {}) as Record<string, unknown>)}
    delete formDataWithoutPhone.phone
    const normalizedFormData = {...formDataWithoutPhone} as Record<string, unknown>
    if (user.name?.trim()) normalizedFormData.fullName = user.name.trim()
    if (user.email?.trim()) normalizedFormData.email = user.email.trim()
    const specialtyRaw =
        typeof normalizedFormData.specialty === "string" ? normalizedFormData.specialty :
            typeof normalizedFormData.specialization === "string" ? normalizedFormData.specialization :
                typeof normalizedFormData.interiorStyle === "string" ? normalizedFormData.interiorStyle :
                    ""
    if (specialtyRaw) {
        normalizedFormData.specialty = specialtyRaw
        normalizedFormData.specialization = specialtyRaw
    }
    const jsonFormData = normalizedFormData as Prisma.InputJsonValue;
    await prisma.user.update({where: {id: user.id}, data: {phone}});
    await prisma.specialistProfile.update({
        where: {id: user.specialistProfile.id},
        data: {formData: jsonFormData, onboardingStatus: "PENDING"},
    });

    const admin = await prisma.user.findFirst({where: {role: "ADMIN"}});
    if (admin?.email) void sendEmail("new_application", admin.email, {specialistId: user.id});

    const fullNameFromForm =
        typeof normalizedFormData.fullName === "string" ? normalizedFormData.fullName.trim() : "";
    const specialistName = fullNameFromForm || user.name?.trim() || user.email || "Специалист";
    const admins = await prisma.user.findMany({where: {role: "ADMIN"}, select: {id: true}});
    for (const a of admins) {
        await notify(
            a.id,
            "new_application",
            "Новая анкета специалиста",
            `${specialistName} подал(а) заявку на регистрацию`,
            "/admin/specialists",
        );
    }

    return NextResponse.json({ok: true});
}

export async function GET() {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json(null);

    const {role, id, zitadelSub} = session.user as { role: string; id: string; zitadelSub?: string | null };
    if (role !== "SPECIALIST") return NextResponse.json(null);

    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id},
        include: {specialistProfile: true},
    });
    if (!user) return NextResponse.json(null);

    const formData = (user.specialistProfile?.formData ?? null) as Record<string, unknown> | null;
    const profileName = user.name?.trim() ?? ""
    const profileEmail = user.email?.trim() ?? ""
    return NextResponse.json({
        ...(formData ?? {}),
        phone: user.phone ?? "",
        fullName: profileName || (typeof formData?.fullName === "string" ? formData.fullName : ""),
        email: profileEmail || (typeof formData?.email === "string" ? formData.email : ""),
        _profileLocks: {
            fullName: Boolean(profileName),
            email: Boolean(profileEmail),
        },
    });
}
