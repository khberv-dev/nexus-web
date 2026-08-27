import {NextRequest} from "next/server"

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getSessionDbUser: jest.fn(),
}))
jest.mock("@/lib/db/prisma", () => ({
    prisma: {
        order: {findUnique: jest.fn()},
        orderChatReadState: {upsert: jest.fn()},
        $queryRaw: jest.fn(),
    },
}))
jest.mock("@/lib/order-chat-realtime", () => ({
    publishOrderChatEvent: jest.fn(),
    visibleOrderChatChannels: (role: string) => role === "CLIENT" ? ["ADMIN_CLIENT"] : [],
}))

import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {publishOrderChatEvent} from "@/lib/order-chat-realtime"
import {POST} from "@/app/api/orders/[id]/chat/read/route"

const ORDER_ID = "order-chat-1"
const CLIENT_ID = "client-1"
const DB_NOW = new Date("2026-08-27T12:06:43.136Z")

describe("POST order chat read", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(getSessionUser as jest.Mock).mockResolvedValue({id: CLIENT_ID, role: "CLIENT", email: "client@test.local"})
        ;(getSessionDbUser as jest.Mock).mockResolvedValue({id: CLIENT_ID})
        ;(prisma.order.findUnique as jest.Mock).mockResolvedValue({
            id: ORDER_ID,
            clientId: CLIENT_ID,
            specialistId: "specialist-1",
            deletedAt: null,
        })
        ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{now: DB_NOW}])
        ;(prisma.orderChatReadState.upsert as jest.Mock).mockResolvedValue({})
        ;(publishOrderChatEvent as jest.Mock).mockResolvedValue(undefined)
    })

    test("uses the database clock and marks the client's visible channel", async () => {
        const request = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/chat/read?channel=ALL`, {method: "POST"})
        const response = await POST(request, {params: Promise.resolve({id: ORDER_ID})})

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ok: true, unread: 0})
        expect(prisma.orderChatReadState.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {orderId_userId_channel: {orderId: ORDER_ID, userId: CLIENT_ID, channel: "ADMIN_CLIENT"}},
            update: {lastReadAt: DB_NOW},
        }))
        expect(publishOrderChatEvent).toHaveBeenCalledWith({
            type: "chat.read",
            orderId: ORDER_ID,
            channels: ["ADMIN_CLIENT"],
            userId: CLIENT_ID,
        })
    })

    test("rejects a client who does not own the order", async () => {
        ;(prisma.order.findUnique as jest.Mock).mockResolvedValue({
            id: ORDER_ID,
            clientId: "another-client",
            specialistId: null,
            deletedAt: null,
        })
        const request = new NextRequest(`http://localhost/api/orders/${ORDER_ID}/chat/read?channel=ALL`, {method: "POST"})
        const response = await POST(request, {params: Promise.resolve({id: ORDER_ID})})
        expect(response.status).toBe(403)
        expect(prisma.orderChatReadState.upsert).not.toHaveBeenCalled()
    })
})
