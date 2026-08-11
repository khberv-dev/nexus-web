import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {notify} from "@/lib/notifications"
import {audit} from "@/lib/audit"
import type {Prisma} from "@prisma/client"

/** GET — список запросов (для админки) */
export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const status = req.nextUrl.searchParams.get("status") ?? "PENDING"
    const requests = await prisma.requisiteChangeRequest.findMany({
        where: {status: status as "PENDING" | "APPROVED" | "REJECTED"},
        include: {
            specialist: {select: {id: true, name: true, email: true}},
            client: {select: {id: true, name: true, email: true}},
        },
        orderBy: {createdAt: "desc"},
        take: 50,
    })
    return NextResponse.json(requests)
}

/** PATCH — одобрить или отклонить */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {requestId, action, comment} = await req.json() as {
        requestId: string; action: "approve" | "reject"; comment?: string
    }

    const request = await prisma.requisiteChangeRequest.findUnique({where: {id: requestId}})
    if (!request || request.status !== "PENDING") {
        return NextResponse.json({error: "Запрос не найден или уже обработан"}, {status: 404})
    }

    if (action === "approve") {
        // Apply new requisites to specialist profile
        if (request.specialistId) {
            const profile = await prisma.specialistProfile.findUnique({where: {userId: request.specialistId}})
            if (profile) {
                const oldFormData = (profile.formData ?? {}) as Record<string, unknown>
                const newRequisites = request.newData as Record<string, unknown>
                const merged = {...oldFormData, ...newRequisites} as Prisma.InputJsonValue
                await prisma.specialistProfile.update({where: {userId: request.specialistId}, data: {formData: merged}})
            }
        }

        // Apply new requisites to client profile
        if (request.clientId) {
            const profile = await prisma.clientProfile.findUnique({where: {userId: request.clientId}})
            if (profile) {
                const oldFormData = (profile.formData ?? {}) as Record<string, unknown>
                const newRequisites = request.newData as Record<string, unknown>
                const merged = {...oldFormData, ...newRequisites} as Prisma.InputJsonValue
                await prisma.clientProfile.update({where: {userId: request.clientId}, data: {formData: merged}})
            }
        }

        await prisma.requisiteChangeRequest.update({
            where: {id: requestId},
            data: {status: "APPROVED", reviewedAt: new Date(), reviewedBy: user.id, adminComment: comment},
        })

        const notifyUserId = request.specialistId ?? request.clientId!
        const cabinetUrl = request.clientId ? "/orders?tab=payments" : "/work/community?tab=settings"
        void notify(notifyUserId, "requisite_change", "Реквизиты обновлены", "Ваш запрос на смену реквизитов одобрен.", cabinetUrl)
    } else {
        await prisma.requisiteChangeRequest.update({
            where: {id: requestId},
            data: {status: "REJECTED", reviewedAt: new Date(), reviewedBy: user.id, adminComment: comment},
        })

        const notifyUserId = request.specialistId ?? request.clientId!
        const cabinetUrl = request.clientId ? "/orders?tab=payments" : "/work/community?tab=settings"
        void notify(notifyUserId, "requisite_change", "Запрос отклонён", comment || "Ваш запрос на смену реквизитов отклонён.", cabinetUrl)
    }

    const targetUserId = request.specialistId ?? request.clientId!
    await audit(user.id, `requisite_change_${action}d`, "User", targetUserId, {
        requestId: {to: requestId},
        action: {to: action},
        comment: {to: comment ?? null}
    })

    return NextResponse.json({ok: true})
}
