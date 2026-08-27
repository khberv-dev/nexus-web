import {createServer} from "node:http"
import {jwtVerify} from "jose"
import Redis from "ioredis"
import {WebSocket, WebSocketServer} from "ws"

const port = Number.parseInt(process.env.CHAT_WS_PORT || "3001", 10)
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
const secretRaw = process.env.CHAT_WS_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
if (!secretRaw) throw new Error("CHAT_WS_SECRET or NEXTAUTH_SECRET is required for chat WebSocket")
const secret = new TextEncoder().encode(secretRaw)

const clients = new Map()
let lastRedisErrorAt = 0
const subscriber = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 250, 5_000),
})
subscriber.on("error", (error) => {
    const now = Date.now()
    if (now - lastRedisErrorAt < 30_000) return
    lastRedisErrorAt = now
    console.error("[chat-ws] Redis subscriber error:", error)
})

function canView(role, channel) {
    if (role === "ADMIN") return channel === "ADMIN_CLIENT" || channel === "ADMIN_SPECIALIST"
    if (role === "CLIENT") return channel === "ADMIN_CLIENT"
    if (role === "SPECIALIST") return channel === "ADMIN_SPECIALIST"
    return false
}

const server = createServer((request, response) => {
    if (request.url === "/health") {
        response.writeHead(200, {"Content-Type": "application/json"})
        response.end(JSON.stringify({ok: true}))
        return
    }
    response.writeHead(404)
    response.end()
})
const websocketServer = new WebSocketServer({noServer: true, maxPayload: 8_192})

server.on("upgrade", async (request, socket, head) => {
    try {
        const url = new URL(request.url || "/", "http://localhost")
        if (url.pathname !== "/ws/chat") throw new Error("Not found")
        const token = url.searchParams.get("token")
        if (!token) throw new Error("Missing token")
        const {payload} = await jwtVerify(token, secret, {algorithms: ["HS256"]})
        if (typeof payload.sub !== "string" || typeof payload.orderId !== "string" || typeof payload.role !== "string") {
            throw new Error("Invalid token")
        }
        websocketServer.handleUpgrade(request, socket, head, (websocket) => {
            websocketServer.emit("connection", websocket, {
                userId: payload.sub,
                orderId: payload.orderId,
                role: payload.role,
                expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 120_000,
            })
        })
    } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
        socket.destroy()
    }
})

websocketServer.on("connection", (socket, context) => {
    clients.set(socket, context)
    socket.isAlive = true
    socket.on("pong", () => {
        socket.isAlive = true
    })
    socket.on("close", () => clients.delete(socket))
    socket.send(JSON.stringify({type: "connected", orderId: context.orderId}))
    const expiresIn = Math.max(1_000, context.expiresAt - Date.now())
    const expiryTimer = setTimeout(() => socket.close(4001, "Token expired"), expiresIn)
    socket.once("close", () => clearTimeout(expiryTimer))
})

subscriber.on("pmessage", (_pattern, redisChannel, raw) => {
    const orderId = redisChannel.slice("order-chat:".length)
    let event
    try {
        event = JSON.parse(raw)
    } catch {
        return
    }
    for (const [socket, context] of clients) {
        if (socket.readyState !== WebSocket.OPEN || context.orderId !== orderId) continue
        if (event.type === "chat.message" && !canView(context.role, event.channel)) continue
        if (event.type === "chat.read" && !event.channels.some((channel) => canView(context.role, channel))) continue
        socket.send(raw)
    }
})

void subscriber.psubscribe("order-chat:*").catch((error) => {
    console.error("[chat-ws] Redis subscription failed; REST polling remains active:", error)
})

const heartbeat = setInterval(() => {
    for (const socket of clients.keys()) {
        if (!socket.isAlive) {
            socket.terminate()
            continue
        }
        socket.isAlive = false
        socket.ping()
    }
}, 25_000)
heartbeat.unref()

server.listen(port, "0.0.0.0", () => console.log(`[chat-ws] listening on :${port}`))
