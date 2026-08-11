import {NextRequest, NextResponse} from "next/server"
import {Role} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"

type OrderChatChannel = "ADMIN_CLIENT" | "ADMIN_SPECIALIST"

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

function visibleChannelsFor(role: Role, requested: OrderChatChannel | "ALL"): OrderChatChannel[] {
    if (role === Role.ADMIN) {
        if (requested === "ALL") return ["ADMIN_CLIENT", "ADMIN_SPECIALIST"]
        return [requested]
    }
    if (role === Role.CLIENT) return ["ADMIN_CLIENT"]
    if (role === Role.SPECIALIST) return ["ADMIN_SPECIALIST"]
    return []
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
    const channels = visibleChannelsFor(user.role as Role, requested)
    if (channels.length === 0) return NextResponse.json({error: "Forbidden"}, {status: 403})
    const order = await loadOrderForChat(orderId)
    if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
    if (!canAccess(order, dbUser.id, user.role as Role)) return NextResponse.json({error: "Forbidden"}, {status: 403})

    const now = new Date()

    try {
        await Promise.all(
            channels.map((ch) =>
                prisma.$executeRaw`
          INSERT INTO "OrderChatReadState" ("id","orderId","userId","channel","lastReadAt","updatedAt")
          VALUES (gen_random_uuid()::text, ${orderId}, ${dbUser.id}, ${ch}::"OrderChatChannel", ${now}, ${now})
          ON CONFLICT ("orderId","userId","channel")
          DO UPDATE SET "lastReadAt" = EXCLUDED."lastReadAt", "updatedAt" = EXCLUDED."updatedAt"
        `,
            ),
        )
        return NextResponse.json({ok: true})
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

