import {redis} from "@/lib/redis"

export type OrderChatChannel = "ADMIN_CLIENT" | "ADMIN_SPECIALIST"

export type OrderChatRealtimeEvent =
    | { type: "chat.message"; orderId: string; channel: OrderChatChannel; senderId: string; messageId: string }
    | { type: "chat.read"; orderId: string; channels: OrderChatChannel[]; userId: string }

export function orderChatRedisChannel(orderId: string): string {
    return `order-chat:${orderId}`
}

export function visibleOrderChatChannels(
    role: string,
    requested: OrderChatChannel | "ALL",
): OrderChatChannel[] {
    if (role === "ADMIN") {
        return requested === "ALL" ? ["ADMIN_CLIENT", "ADMIN_SPECIALIST"] : [requested]
    }
    if (role === "CLIENT") return ["ADMIN_CLIENT"]
    if (role === "SPECIALIST") return ["ADMIN_SPECIALIST"]
    return []
}

export function canViewOrderChatChannel(role: string, channel: OrderChatChannel): boolean {
    return visibleOrderChatChannels(role, "ALL").includes(channel)
}

export async function publishOrderChatEvent(event: OrderChatRealtimeEvent): Promise<void> {
    try {
        await redis.publish(orderChatRedisChannel(event.orderId), JSON.stringify(event))
    } catch (error) {
        // Redis/WebSocket delivery is an acceleration path. REST polling remains authoritative.
        console.error("[order_chat] realtime publish failed:", error)
    }
}
