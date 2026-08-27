"use client"

export type OrderChatSocketEvent =
    | { type: "chat.message"; orderId: string; channel: "ADMIN_CLIENT" | "ADMIN_SPECIALIST"; senderId: string; messageId: string }
    | { type: "chat.read"; orderId: string; channels: Array<"ADMIN_CLIENT" | "ADMIN_SPECIALIST">; userId: string }
    | { type: "connected"; orderId: string }

type Listener = (event: OrderChatSocketEvent) => void

type Connection = {
    listeners: Set<Listener>
    socket: WebSocket | null
    reconnectTimer: number | null
    attempts: number
    disposed: boolean
}

const connections = new Map<string, Connection>()

function websocketUrl(token: string): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`
}

function scheduleReconnect(orderId: string, connection: Connection) {
    if (connection.disposed || connection.reconnectTimer) return
    const delay = Math.min(1_000 * 2 ** connection.attempts, 20_000)
    connection.attempts += 1
    connection.reconnectTimer = window.setTimeout(() => {
        connection.reconnectTimer = null
        void connect(orderId, connection)
    }, delay)
}

async function connect(orderId: string, connection: Connection) {
    if (connection.disposed || connection.socket?.readyState === WebSocket.OPEN || connection.socket?.readyState === WebSocket.CONNECTING) return
    try {
        const response = await fetch(`/api/orders/${orderId}/chat/socket-token`, {
            method: "POST",
            cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as { token?: unknown }
        if (!response.ok || typeof payload.token !== "string") {
            scheduleReconnect(orderId, connection)
            return
        }
        if (connection.disposed) return

        const socket = new WebSocket(websocketUrl(payload.token))
        connection.socket = socket
        socket.onopen = () => {
            connection.attempts = 0
        }
        socket.onmessage = (message) => {
            try {
                const event = JSON.parse(String(message.data)) as OrderChatSocketEvent
                for (const listener of connection.listeners) listener(event)
            } catch {
                // Ignore malformed frames; REST polling remains active.
            }
        }
        socket.onerror = () => socket.close()
        socket.onclose = () => {
            if (connection.socket === socket) connection.socket = null
            scheduleReconnect(orderId, connection)
        }
    } catch {
        scheduleReconnect(orderId, connection)
    }
}

export function subscribeToOrderChat(orderId: string, listener: Listener): () => void {
    let connection = connections.get(orderId)
    if (!connection) {
        connection = {listeners: new Set(), socket: null, reconnectTimer: null, attempts: 0, disposed: false}
        connections.set(orderId, connection)
    }
    connection.listeners.add(listener)
    void connect(orderId, connection)

    return () => {
        const current = connections.get(orderId)
        if (!current) return
        current.listeners.delete(listener)
        if (current.listeners.size > 0) return
        current.disposed = true
        if (current.reconnectTimer) window.clearTimeout(current.reconnectTimer)
        current.socket?.close()
        connections.delete(orderId)
    }
}
