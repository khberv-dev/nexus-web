import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import type {Prisma} from "@prisma/client"
import {getSessionUser} from "@/lib/session"

export async function POST(req: NextRequest) {
    const session = await getSessionUser()
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const formData = await req.json()
    const taxStatus = formData?.taxStatus
    if (taxStatus !== "IP" && taxStatus !== "SZ" && taxStatus !== "OOO") {
        return NextResponse.json({error: "Укажите налоговый статус: ИП, самозанятый или ООО."}, {status: 400})
    }

    const fullName = formData?.fullName || formData?.name || null
    const phone = typeof formData?.phone === "string" && formData.phone.trim() ? formData.phone.trim() : null
    if (!phone) {
        return NextResponse.json({error: "Укажите телефон."}, {status: 400})
    }
    const email = typeof formData?.email === "string" && formData.email.trim() ? formData.email.trim() : undefined
    const {phone: _ignoredPhone, email: _ignoredEmail, ...formDataRest} = (formData ?? {}) as Record<string, unknown>
    const normalizedFormData = {...formDataRest} as Record<string, unknown>
    const specialtyRaw =
        typeof normalizedFormData.specialty === "string"
            ? normalizedFormData.specialty
            : typeof normalizedFormData.specialization === "string"
                ? normalizedFormData.specialization
                : typeof normalizedFormData.interiorStyle === "string"
                    ? normalizedFormData.interiorStyle
                    : ""
    if (specialtyRaw) {
        normalizedFormData.specialty = specialtyRaw
        normalizedFormData.specialization = specialtyRaw
    }
    const jsonFormData = normalizedFormData as Prisma.InputJsonValue

    const user = await prisma.user.update({
        where: {id: session.id},
        data: {
            name: fullName ?? undefined,
            phone,
            ...(email ? {email} : {}),
        },
    })

    const bio = typeof formData?.about === "string" && formData.about.trim() ? formData.about.trim() : undefined
    const existingProfile = await prisma.specialistProfile.findUnique({
        where: {userId: user.id},
        select: {onboardingStatus: true, formData: true},
    })

    // 2.9: If ACTIVE specialist changes requisites, create approval request instead
    const REQUISITE_KEYS = [
        "bankAccount",
        "bankName",
        "bankBik",
        "corrAccount",
        "inn",
        "kpp",
        "ogrn",
        "ogrnip",
        "legalAddress",
        "companyName",
        "ipName",
    ]
    if (existingProfile?.onboardingStatus === "ACTIVE") {
        const oldFd = (existingProfile.formData ?? {}) as Record<string, unknown>
        const hasReqChange = REQUISITE_KEYS.some((k) => {
            const o = typeof oldFd[k] === "string" ? oldFd[k] : ""
            const n = typeof normalizedFormData[k] === "string" ? normalizedFormData[k] : ""
            return o !== n
        })
        if (hasReqChange) {
            // Save non-requisite fields directly, create request for requisites
            const safeFormData = {...normalizedFormData} as Record<string, unknown>
            for (const k of REQUISITE_KEYS) safeFormData[k] = oldFd[k] // keep old requisites
            await prisma.specialistProfile.update({
                where: {userId: user.id},
                data: {formData: safeFormData as Prisma.InputJsonValue, ...(bio !== undefined ? {bio} : {})},
            })
            // Create change request
            const pickReq = (d: Record<string, unknown>) => {
                const r: Record<string, string> = {}
                for (const k of REQUISITE_KEYS) if (typeof d[k] === "string" && d[k]) r[k] = d[k] as string
                return r
            }
            const existing = await prisma.requisiteChangeRequest.findFirst({
                where: {specialistId: session.id, status: "PENDING"},
            })
            if (!existing) {
                await prisma.requisiteChangeRequest.create({
                    data: {
                        specialistId: session.id,
                        oldData: pickReq(oldFd),
                        newData: pickReq(normalizedFormData as Record<string, unknown>),
                    },
                })
            }
            return NextResponse.json({
                ok: true,
                requisitesPending: true,
                message: "Профиль сохранён. Изменение реквизитов отправлено на согласование администратору.",
            })
        }
    }

    const profile = await prisma.specialistProfile.upsert({
        where: {userId: user.id},
        update: {
            formData: jsonFormData,
            onboardingStatus: "PENDING",
            ...(bio !== undefined ? {bio} : {}),
        },
        create: {
            userId: user.id,
            formData: jsonFormData,
            onboardingStatus: "PENDING",
            ...(bio !== undefined ? {bio} : {}),
        },
    })

    const existingFormStep = await prisma.onboardingStep.findFirst({
        where: {profileId: profile.id, type: "FORM"},
    })
    if (existingFormStep) {
        await prisma.onboardingStep.update({where: {id: existingFormStep.id}, data: {status: "PASSED"}})
    } else {
        await prisma.onboardingStep.create({data: {profileId: profile.id, type: "FORM", status: "PASSED"}})
    }

    return NextResponse.json({ok: true})
}

export async function GET() {
    const session = await getSessionUser()
    if (!session) return NextResponse.json(null)
    if (session.role !== "SPECIALIST") return NextResponse.json(null)

    const user = await prisma.user.findUnique({
        where: {id: session.id},
        include: {specialistProfile: true},
    })

    if (!user) return NextResponse.json(null)
    const formData = (user.specialistProfile?.formData ?? null) as Record<string, unknown> | null
    return NextResponse.json(
        formData
            ? {...formData, phone: user.phone ?? "", email: user.email ?? ""}
            : {phone: user.phone ?? "", email: user.email ?? ""}
    )
}

