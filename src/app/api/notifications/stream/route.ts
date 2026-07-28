import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/session"
import { createSubscriber, notificationChannel } from "@/lib/redis"

export const dynamic = "force-dynamic"

const PING_INTERVAL_MS = 25_000 // keep-alive ping every 25s (proxies drop idle SSE after ~30s)

export async function GET(_req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const subscriber = createSubscriber()
  const channel = notificationChannel(user.id)
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let subscribed = false

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${data}\n\n`))
        } catch {
          // client disconnected — cleanup happens in cancel()
        }
      }

      // Initial ping so the client knows the connection is alive.
      send(JSON.stringify({ type: "connected" }))

      try {
        await subscriber.subscribe(channel)
        subscribed = true
      } catch {
        // Keep stream alive (with pings) even if Redis is temporarily unavailable.
      }

      subscriber.on("message", (_ch: string, message: string) => {
        send(message)
      })

      // Periodic keep-alive ping.
      pingTimer = setInterval(() => {
        send(JSON.stringify({ type: "ping" }))
      }, PING_INTERVAL_MS)
    },

    cancel() {
      if (pingTimer) clearInterval(pingTimer)
      const close = () => subscriber.quit().catch(() => {})
      if (!subscribed) {
        close()
        return
      }
      subscriber.unsubscribe().catch(() => {}).finally(close)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Nginx: disable buffering for SSE
    },
  })
}
