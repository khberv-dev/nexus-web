import {NextResponse} from "next/server"
import {randomUUID} from "crypto"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"

/**
 * POST /api/admin/stages/:id/rules/send
 * Marks rules as sent to designer and posts a message to order chat (ADMIN_SPECIALIST).
 */
export async function POST(_req: Request, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    const {id} = await params
    const stage = await prisma.projectStage.findUnique({
        where: {id},
        include: {order: {select: {id: true, specialistId: true}}},
    })
    if (!stage) return NextResponse.json({error: "Not found"}, {status: 404})
    if (!stage.rulesS3Key) return NextResponse.json({error: "No rules attached"}, {status: 409})
    if (!stage.order.specialistId) return NextResponse.json({error: "У заказа нет назначенного дизайнера"}, {status: 409})

    const shortOrder = stage.order.id.slice(-6).toUpperCase()
    const body = `Размещены правила для этапа по заказу #${shortOrder}.\nСкачать: /api/stages/${stage.id}/rules`

    const now = new Date()

    // Mark sent + remember which version was sent.
    try {
        await prisma.$executeRaw`
      UPDATE "ProjectStage"
      SET "rulesSentAt" = ${now}, "rulesSentS3Key" = ${stage.rulesS3Key}
      WHERE id = ${stage.id}
    `
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[stage_rules_send] stage update failed:", e)
        return NextResponse.json({error: "Не удалось обновить статус отправки", hint: msg}, {status: 500})
    }

    // Post chat message to designer channel (admin↔designer).
    try {
        const msgId = randomUUID()
        await prisma.$executeRaw`
      INSERT INTO "OrderChatMessage" ("id","orderId","channel","senderId","body")
      VALUES (${msgId}, ${stage.order.id}, ${"ADMIN_SPECIALIST"}::"OrderChatChannel", ${dbUser.id}, ${body})
    `
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[stage_rules_send] chat insert failed:", e)
        return NextResponse.json(
            {error: "Не удалось отправить сообщение дизайнеру", hint: msg},
            {status: 500},
        )
    }

    return NextResponse.json({ok: true, rulesSentAt: now.toISOString(), rulesSentS3Key: stage.rulesS3Key})
}

