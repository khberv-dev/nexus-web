import {NextRequest, NextResponse} from "next/server"
import {Role} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {
    publishOrderChatEvent,
    type OrderChatChannel,
    visibleOrderChatChannels,
} from "@/lib/order-chat-realtime"


function isMissingOrderChatRelation(error: unknown): boolean {
    const m = error instanceof Error ? error.message : String(error)
    return (
        /OrderChatReadState/i.test(m) ||
        /42P01/.test(m) ||
        /relation .* does not exist/i.test(m) ||
        /no such table/i.test(m)
    )
}

async function loadOrderForChat(orderId: string) {
    return prisma.order.findUnique({
        where: {id: orderId},
        select: {
            id: true,
            deletedAt: true,
            clientId: true,
            specialistId: true,
        },
    })
}

function canAccess(order: NonNullable<Awaited<ReturnType<typeof loadOrderForChat>>>, dbUserId: string, role: Role): boolean {
    if (role === Role.ADMIN) return true
    if (role === Role.CLIENT) return order.clientId === dbUserId
    if (role === Role.SPECIALIST) return order.specialistId === dbUserId
    return false
}

function parseChannel(req: NextRequest): OrderChatChannel | "ALL" {
    const raw = req.nextUrl.searchParams.get("channel")
    if (raw === "ALL") return "ALL"
    if (raw === "ADMIN_CLIENT") return "ADMIN_CLIENT"
    if (raw === "ADMIN_SPECIALIST") return "ADMIN_SPECIALIST"
    return "ALL"
}

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    if (user.role !== Role.CLIENT && user.role !== Role.SPECIALIST && user.role !== Role.ADMIN) {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const {id: orderId} = await params
    const requested = parseChannel(_req)
    const channels = visibleOrderChatChannels(user.role, requested)
    if (channels.length === 0) return NextResponse.json({error: "Forbidden"}, {status: 403})
    const order = await loadOrderForChat(orderId)
    if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
    if (!canAccess(order, dbUser.id, user.role as Role)) return NextResponse.json({error: "Forbidden"}, {status: 403})

    try {
        // Messages receive their createdAt from PostgreSQL. Use the same clock for read receipts:
        // the application host and database may run in different time zones or have clock skew.
        const clockRows = await prisma.$queryRaw<{ now: Date }[]>`
          SELECT CURRENT_TIMESTAMP AS now
        `
        const now = clockRows[0]?.now
        if (!now) throw new Error("Database clock is unavailable")

        await Promise.all(
            channels.map((ch) =>
                prisma.orderChatReadState.upsert({
                    where: {
                        orderId_userId_channel: {
                            orderId,
                            userId: dbUser.id,
                            channel: ch,
                        },
                    },
                    create: {
                        orderId,
                        userId: dbUser.id,
                        channel: ch,
                        lastReadAt: now,
                    },
                    update: {lastReadAt: now},
                }),
            ),
        )
        void publishOrderChatEvent({
            type: "chat.read",
            orderId,
            channels,
            userId: dbUser.id,
        })
        return NextResponse.json({ok: true, unread: 0})
    } catch (e) {
        console.error("[order_chat] read failed:", e)
        if (isMissingOrderChatRelation(e)) {
            return NextResponse.json(
                {
                    error: "Чат заказа не развёрнут в базе (нет таблицы состояния прочтения).",
                    hint: "Примените миграции."
                },
                {status: 503},
            )
        }
        return NextResponse.json({error: "Не удалось отметить как прочитанное"}, {status: 500})
    }
}
