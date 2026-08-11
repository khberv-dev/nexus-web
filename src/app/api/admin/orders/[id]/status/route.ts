import {NextRequest, NextResponse} from "next/server"
import {z} from "zod"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {OrderStatus} from "@prisma/client"
import {audit} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {parseJsonBody} from "@/lib/validate"

const statusSchema = z.object({
    status: z.enum(["DRAFT", "BRIEFING", "BRIEF_REVIEW", "ACTIVE", "DONE", "CANCELLED"]),
})

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const parsed = await parseJsonBody(req, statusSchema)
    if (!parsed.ok) return parsed.response
    const {status} = parsed.data

    const order = await prisma.order.findUnique({
        where: {id},
        select: {status: true, clientId: true, specialistId: true, deletedAt: true}
    })
    if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
    await prisma.order.update({where: {id}, data: {status: status as OrderStatus}})

    const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
    await audit(dbUser?.id ?? null, "order_status_changed", "Order", id, {status: {from: order?.status, to: status}})

    const shortId = id.slice(-6).toUpperCase()
    if (order) {
        if (status === "BRIEF_REVIEW") {
            void notify(order.clientId, "brief_review", "Бриф на проверке", `Заказ #${shortId} принят в работу`, `/orders/${id}`)
        } else if (status === "ACTIVE") {
            void notify(order.clientId, "order_active", "Проект запущен", `Заказ #${shortId} переведен в работу`, `/orders/${id}`)
        } else if (status === "DONE") {
            void notify(order.clientId, "order_done", "Проект завершен", `Заказ #${shortId} успешно завершен`, `/orders/${id}`)
            if (order.specialistId) void notify(order.specialistId, "order_done", "Проект завершен", `Заказ #${shortId} завершен`, `/work/${id}`)
        } else if (status === "CANCELLED") {
            void notify(order.clientId, "order_cancelled", "Проект отменен", `Заказ #${shortId} отменен`, `/orders/${id}`)
            if (order.specialistId) void notify(order.specialistId, "order_cancelled", "Проект отменен", `Заказ #${shortId} отменен`, `/work/${id}`)
        }
    }

    return NextResponse.json({ok: true})
}
