import {NextRequest, NextResponse} from "next/server"
import {Role} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {type OrderChatChannel, visibleOrderChatChannels} from "@/lib/order-chat-realtime"


function isMissingOrderChatRelation(error: unknown): boolean {
    const m = error instanceof Error ? error.message : String(error)
    return (
        /OrderChatMessage/i.test(m) ||
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

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
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
        const counts = await Promise.all(
            channels.map(async (ch) => {
                const rows = await prisma.$queryRaw<{ unread: bigint }[]>`
          SELECT COUNT(*)::bigint AS unread
          FROM "OrderChatMessage" m
          LEFT JOIN "OrderChatReadState" s
            ON s."orderId" = m."orderId"
           AND s."userId" = ${dbUser.id}
           AND s."channel" = m."channel"
          WHERE m."orderId" = ${orderId}
            AND m."channel" = ${ch}::"OrderChatChannel"
            AND m."senderId" <> ${dbUser.id}
            AND m."createdAt" > COALESCE(s."lastReadAt", to_timestamp(0))
        `
                const v = rows?.[0]?.unread
                return typeof v === "bigint" ? Number(v) : Number(v ?? 0)
            }),
        )

        const total = counts.reduce((a, b) => a + b, 0)
        return NextResponse.json({unread: total})
    } catch (e) {
        console.error("[order_chat] unread failed:", e)
        if (isMissingOrderChatRelation(e)) {
            return NextResponse.json(
                {
                    error: "Чат заказа не развёрнут в базе (нет таблиц).",
                    hint: "Примените миграции: docker compose run --rm migrate"
                },
                {status: 503},
            )
        }
        return NextResponse.json({error: "Не удалось получить счётчик"}, {status: 500})
    }
}
