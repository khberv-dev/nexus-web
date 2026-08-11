import {NextRequest, NextResponse} from "next/server"
import {z} from "zod"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {sendEmail} from "@/lib/email"
import {notify} from "@/lib/notifications"
import {isStagePaymentsDisabled} from "@/lib/payments/flags"
import {syncStageSequentialLocks} from "@/lib/stage-sequencing"
import {parseJsonBody} from "@/lib/validate"

const assignSchema = z.object({specialistId: z.string().min(1)})

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const parsed = await parseJsonBody(req, assignSchema)
    if (!parsed.ok) return parsed.response
    const {specialistId} = parsed.data

    const before = await prisma.order.findUnique({
        where: {id, deletedAt: null},
        select: {id: true, status: true},
    })
    if (!before) return NextResponse.json({error: "Заказ не найден"}, {status: 404})

    const order = await prisma.order.update({
        where: {id},
        // Назначение специалиста НЕ активирует заказ.
        // Активировать заказ можно только после подтверждения договора администратором.
        data: {specialistId},
        include: {
            specialist: {select: {email: true}},
            client: {select: {email: true}},
        },
    })

    const existing = await prisma.projectStage.findMany({where: {orderId: id}})
    const required = ["CONCEPT", "PLANNING", "VISUALIZATION", "DOCUMENTATION", "SPECIFICATION"] as const
    const existingTypes = new Set(existing.map(s => s.type))

    const missing = required.filter(t => !existingTypes.has(t as never))
    if (missing.length > 0) {
        await prisma.projectStage.createMany({
            data: missing.map(t => ({orderId: id, type: t as never})),
        })
    }

    // Ensure the first stage requires initial payment (new flow: pay once before start).
    const concept = await prisma.projectStage.findFirst({where: {orderId: id, type: "CONCEPT" as never}})
    if (!isStagePaymentsDisabled() && concept && concept.status === "PENDING") {
        await prisma.projectStage.update({where: {id: concept.id}, data: {status: "AWAITING_PAYMENT"}})
    }

    const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
    await audit(dbUser?.id ?? null, "specialist_assigned", "Order", id, {
        specialistId: {to: specialistId},
        status: {from: before.status, to: order.status},
    })

    const shortId = id.slice(-6).toUpperCase()

    // Notify specialist
    if (order.specialist?.email) {
        void sendEmail("order_assigned", order.specialist.email, {orderId: id})
    }
    if (specialistId) {
        void notify(specialistId, "order_assigned", "Новый заказ", `Вам назначен заказ #${shortId}`, `/work/${id}`)
    }

    // Notify client
    void notify(order.clientId, "specialist_assigned", "Специалист назначен", `На ваш заказ #${shortId} назначен специалист`, `/orders/${id}`)

    await syncStageSequentialLocks(id)

    return NextResponse.json({ok: true})
}
