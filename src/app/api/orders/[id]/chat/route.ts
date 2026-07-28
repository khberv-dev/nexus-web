import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { Role } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { notify } from "@/lib/notifications"

const MAX_BODY = 8000

function isMissingOrderChatRelation(error: unknown): boolean {
  const m = error instanceof Error ? error.message : String(error)
  return (
    /OrderChatMessage/i.test(m) ||
    /42P01/.test(m) ||
    /relation .* does not exist/i.test(m) ||
    /no such table/i.test(m)
  )
}

async function loadOrderForChat(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      deletedAt: true,
      clientId: true,
      specialistId: true,
    },
  })
}

type OrderChatChannel = "ADMIN_CLIENT" | "ADMIN_SPECIALIST"

function parseChannel(req: NextRequest): "ALL" | OrderChatChannel {
  const raw = req.nextUrl.searchParams.get("channel")
  if (raw === "ALL") return "ALL"
  if (raw === "ADMIN_CLIENT") return "ADMIN_CLIENT"
  if (raw === "ADMIN_SPECIALIST") return "ADMIN_SPECIALIST"
  // default: for backward compat
  return "ADMIN_CLIENT"
}

function visibleChannelsFor(role: Role, requested: "ALL" | OrderChatChannel): OrderChatChannel[] {
  if (role === Role.ADMIN) {
    if (requested === "ALL") return ["ADMIN_CLIENT", "ADMIN_SPECIALIST"]
    return [requested]
  }
  // Клиент/дизайнер видят только свой приватный канал с админом.
  if (role === Role.CLIENT) return ["ADMIN_CLIENT"]
  if (role === Role.SPECIALIST) return ["ADMIN_SPECIALIST"]
  return []
}

function canAccess(order: NonNullable<Awaited<ReturnType<typeof loadOrderForChat>>>, dbUserId: string, role: Role): boolean {
  if (role === Role.ADMIN) return true
  if (role === Role.CLIENT) return order.clientId === dbUserId
  if (role === Role.SPECIALIST) return order.specialistId === dbUserId
  return false
}

type MessageRow = {
  id: string
  body: string
  createdAt: Date
  senderId: string
  senderName: string | null
  senderEmail: string | null
  senderRole: Role
}

type InsertedRow = MessageRow & { channel: OrderChatChannel }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (user.role !== Role.CLIENT && user.role !== Role.SPECIALIST && user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: orderId } = await params

  const order = await loadOrderForChat(orderId)
  if (!order || order.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!canAccess(order, dbUser.id, user.role as Role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const requested = parseChannel(_req)
  const channels = visibleChannelsFor(user.role as Role, requested)
  if (channels.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let rows: MessageRow[]
  try {
    rows = await prisma.$queryRaw<MessageRow[]>`
      SELECT m.id, m.body, m."createdAt",
             u.id AS "senderId",
             u.name AS "senderName",
             u.email AS "senderEmail",
             u.role AS "senderRole"
      FROM "OrderChatMessage" m
      INNER JOIN "User" u ON u.id = m."senderId"
      WHERE m."orderId" = ${orderId}
        AND m."channel" = ANY(${channels}::"OrderChatChannel"[])
      ORDER BY m."createdAt" ASC
      LIMIT 500
    `
  } catch (e) {
    console.error("[order_chat] GET query failed:", e)
    if (isMissingOrderChatRelation(e)) {
      return NextResponse.json(
        { error: "Чат заказа не развёрнут в базе (нет таблицы сообщений).", hint: "Примените миграции: npm run db:deploy" },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Не удалось загрузить чат" }, { status: 500 })
  }

  return NextResponse.json({
    viewerId: dbUser.id,
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: { id: m.senderId, name: m.senderName, email: m.senderEmail, role: m.senderRole },
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (user.role !== Role.CLIENT && user.role !== Role.SPECIALIST && user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: orderId } = await params

  const order = await loadOrderForChat(orderId)
  if (!order || order.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!canAccess(order, dbUser.id, user.role as Role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let bodyText: string
  let sendChannelRaw: string | null = null
  try {
    const json = (await req.json()) as { body?: unknown; sendChannel?: unknown }
    bodyText = typeof json.body === "string" ? json.body : ""
    sendChannelRaw = typeof json.sendChannel === "string" ? json.sendChannel : null
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const trimmed = bodyText.trim()
  if (!trimmed) return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 })
  if (trimmed.length > MAX_BODY) return NextResponse.json({ error: `Не более ${MAX_BODY} символов` }, { status: 400 })

  const role = user.role as Role
  const requested = parseChannel(req)
  const msgId = randomUUID()

  let channelToSend: OrderChatChannel
  if (role === Role.CLIENT) {
    channelToSend = "ADMIN_CLIENT"
  } else if (role === Role.SPECIALIST) {
    channelToSend = "ADMIN_SPECIALIST"
  } else {
    const pick = sendChannelRaw ?? (requested === "ALL" ? "ADMIN_CLIENT" : String(requested))
    if (pick === "ADMIN_CLIENT") channelToSend = "ADMIN_CLIENT"
    else if (pick === "ADMIN_SPECIALIST") channelToSend = "ADMIN_SPECIALIST"
    else channelToSend = "ADMIN_CLIENT"
  }

  if (channelToSend === "ADMIN_SPECIALIST" && !order.specialistId) {
    return NextResponse.json({ error: "У заказа нет назначенного дизайнера" }, { status: 409 })
  }

  let inserted: InsertedRow[]
  try {
    await prisma.$executeRaw`
      INSERT INTO "OrderChatMessage" ("id","orderId","channel","senderId","body")
      VALUES (${msgId}, ${orderId}, ${channelToSend}::"OrderChatChannel", ${dbUser.id}, ${trimmed})
    `

    inserted = await prisma.$queryRaw<InsertedRow[]>`
      SELECT m.id, m.body, m."createdAt", m."channel",
             u.id AS "senderId",
             u.name AS "senderName",
             u.email AS "senderEmail",
             u.role AS "senderRole"
      FROM "OrderChatMessage" m
      INNER JOIN "User" u ON u.id = m."senderId"
      WHERE m.id = ${msgId}
      LIMIT 1
    `
  } catch (e) {
    console.error("[order_chat] POST failed:", e)
    if (isMissingOrderChatRelation(e)) {
      return NextResponse.json(
        { error: "Чат заказа не развёрнут в базе (нет таблицы сообщений).", hint: "Примените миграции." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 })
  }

  const row = inserted[0]
  if (!row) return NextResponse.json({ error: "Не удалось сохранить сообщение" }, { status: 500 })

  const shortOrder = order.id.slice(-6).toUpperCase()
  const preview = trimmed.length > 140 ? `${trimmed.slice(0, 140).trimEnd()}…` : trimmed

  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })

    if (channelToSend === "ADMIN_CLIENT") {
      if (role === Role.CLIENT) for (const a of admins) await notify(a.id, "order_chat", `Сообщение от заказчика #${shortOrder}`, `«${preview}»`, `/admin/orders?order=${order.id}`)
      if (role === Role.ADMIN) await notify(order.clientId, "order_chat", `Сообщение от администратора #${shortOrder}`, `«${preview}»`, `/orders/${order.id}`)
    } else if (channelToSend === "ADMIN_SPECIALIST") {
      if (role === Role.SPECIALIST) for (const a of admins) await notify(a.id, "order_chat", `Сообщение от дизайнера #${shortOrder}`, `«${preview}»`, `/admin/orders?order=${order.id}`)
      if (role === Role.ADMIN && order.specialistId) await notify(order.specialistId, "order_chat", `Сообщение от администратора #${shortOrder}`, `«${preview}»`, `/work/${order.id}`)
    }
  } catch (e) {
    console.error("[order_chat] notify failed:", e)
  }

  return NextResponse.json({
    message: {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      sender: { id: row.senderId, name: row.senderName, email: row.senderEmail, role: row.senderRole },
    },
  })
}

