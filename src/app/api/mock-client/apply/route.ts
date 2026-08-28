import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db/prisma";
import type {Prisma} from "@prisma/client";
import {validateClientRequisitesForm} from "@/lib/client-requisites-validation";
import {getSessionUser} from "@/lib/session";
import {notify} from "@/lib/notifications";
import {audit} from "@/lib/audit";
import {parseJsonBody} from "@/lib/validate";

// Free-form client profile/requisites blob — must preserve ALL keys (they are
// persisted into clientProfile.formData), so a lenient record. Rejects non-objects.
const clientApplySchema = z.record(z.string(), z.unknown());

const REQUISITE_FIELDS = ["bankAccount", "bankName", "bankBik", "corrAccount", "inn", "kpp", "ogrn", "ogrnip", "legalAddress", "companyName", "ipName"] as const

function pickRequisites(data: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const key of REQUISITE_FIELDS) {
        if (typeof data[key] === "string" && data[key]) result[key] = data[key] as string
    }
    return result
}

function hasRequisiteChanges(oldData: Record<string, unknown>, newData: Record<string, unknown>): boolean {
    for (const key of REQUISITE_FIELDS) {
        const o = typeof oldData[key] === "string" ? oldData[key] : ""
        const n = typeof newData[key] === "string" ? newData[key] : ""
        if (o !== n) return true
    }
    return false
}

export async function POST(req: NextRequest) {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    if (session.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const parsed = await parseJsonBody(req, clientApplySchema);
    if (!parsed.ok) return parsed.response;
    const formData = {...(parsed.data as Record<string, unknown>)}
    const lockProfileIdentity = req.nextUrl.searchParams.get("source") === "onboarding"
    const existingUser = await prisma.user.findUnique({
        where: {id: session.id},
        select: {phone: true, name: true, email: true},
    })
    if (lockProfileIdentity && existingUser?.name?.trim()) formData.fullName = existingUser.name.trim()
    if (lockProfileIdentity && existingUser?.email?.trim()) formData.email = existingUser.email.trim()
    const reqErr = validateClientRequisitesForm(formData);
    if (reqErr) return NextResponse.json({error: reqErr}, {status: 400});
    const fullName = formData?.fullName || formData?.name || null;
    const phoneFromBody = typeof formData?.phone === "string" && formData.phone.trim() ? formData.phone.trim() : null;
    const email = typeof formData?.email === "string" && formData.email.trim() ? formData.email.trim() : undefined;
    const formDataRest = {...formData}
    delete formDataRest.phone
    delete formDataRest.email

    const phone = phoneFromBody ?? existingUser?.phone ?? null

    const user = await prisma.user.update({
        where: {id: session.id},
        data: {name: fullName ?? undefined, phone, ...(email ? {email} : {})},
    });

    const existingProfile = await prisma.clientProfile.findUnique({where: {userId: user.id}})
    const oldFormData = (existingProfile?.formData ?? {}) as Record<string, unknown>

    // If requisites changed — create approval request instead of applying directly
    if (existingProfile && hasRequisiteChanges(oldFormData, formDataRest)) {
        const existing = await prisma.requisiteChangeRequest.findFirst({
            where: {clientId: user.id, status: "PENDING"},
        })

        // Save non-requisite fields directly
        const safeFormData = {...formDataRest} as Record<string, unknown>
        for (const key of REQUISITE_FIELDS) safeFormData[key] = oldFormData[key] // keep old requisites
        await prisma.clientProfile.update({
            where: {userId: user.id},
            data: {formData: safeFormData as Prisma.InputJsonValue},
        })

        const oldReq = pickRequisites(oldFormData)
        const newReq = pickRequisites(formDataRest)

        if (existing) {
            await prisma.requisiteChangeRequest.update({
                where: {id: existing.id},
                data: {
                    oldData: oldReq as Prisma.InputJsonValue,
                    newData: newReq as Prisma.InputJsonValue,
                    reviewedAt: null,
                    reviewedBy: null,
                    adminComment: null,
                },
            })
        } else {
            await prisma.requisiteChangeRequest.create({
                data: {
                    clientId: user.id,
                    oldData: oldReq as Prisma.InputJsonValue,
                    newData: newReq as Prisma.InputJsonValue,
                },
            })
        }

        const admins = await prisma.user.findMany({where: {role: "ADMIN"}, select: {id: true}})
        for (const admin of admins) {
            void notify(admin.id, "requisite_change", "Запрос на смену реквизитов", `Заказчик ${user.name ?? user.email} запросил смену реквизитов`, "/admin/clients")
        }
        await audit(user.id, "requisite_change_requested", "User", user.id, {})

        return NextResponse.json({
            ok: true,
            requisitesPending: true,
            message: existing
                ? "Профиль сохранён. Запрос на изменение реквизитов обновлён и ожидает согласования администратора."
                : "Профиль сохранён. Изменение реквизитов отправлено на согласование администратору.",
        })
    }

    // No requisite changes — save everything directly
    const jsonFormData = formDataRest as Prisma.InputJsonValue;
    await prisma.clientProfile.upsert({
        where: {userId: user.id},
        update: {formData: jsonFormData},
        create: {userId: user.id, formData: jsonFormData},
    });

    return NextResponse.json({ok: true});
}

export async function GET(req: NextRequest) {
    const session = await getSessionUser();
    if (!session) return NextResponse.json(null);
    if (session.role !== "CLIENT") return NextResponse.json(null);

    const user = await prisma.user.findUnique({
        where: {id: session.id},
        include: {clientProfile: true},
    });

    if (!user) return NextResponse.json(null);
    const profileData = (user.clientProfile?.formData ?? null) as Record<string, unknown> | null;
    const merged: Record<string, unknown> = profileData ? {...profileData} : {};

    // If requisites are pending admin approval — expose latest requested values to the client UI.
    // They are stored in RequisiteChangeRequest.newData while clientProfile.formData keeps old requisites.
    const pending = await prisma.requisiteChangeRequest.findFirst({
        where: {clientId: user.id, status: "PENDING"},
        orderBy: {createdAt: "desc"},
        select: {newData: true},
    })
    if (pending?.newData && typeof pending.newData === "object" && !Array.isArray(pending.newData)) {
        for (const [k, v] of Object.entries(pending.newData as Record<string, unknown>)) {
            if (typeof v === "string" && v.trim()) merged[k] = v
        }
        merged.requisitesPending = true
    }

    const fn = typeof merged.fullName === "string" ? merged.fullName.trim() : "";
    if (!fn && user.name?.trim()) merged.fullName = user.name.trim();
    const lockProfileIdentity = req.nextUrl.searchParams.get("source") === "onboarding"
    if (lockProfileIdentity && user.name?.trim()) merged.fullName = user.name.trim()
    return NextResponse.json({
        ...merged,
        phone: user.phone ?? "",
        email: user.email ?? "",
        ...(lockProfileIdentity ? {
            _profileLocks: {
                fullName: Boolean(user.name?.trim()),
                email: Boolean(user.email?.trim()),
            },
        } : {}),
    });
}
