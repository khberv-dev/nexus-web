import Redis from "ioredis"

const url = process.env.REDIS_URL ?? "redis://localhost:6379"

function buildRedisClient(label: "redis" | "subscriber"): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
    retryStrategy(times) {
      return Math.min(times * 200, 5_000)
    },
  })

  // Prevent unhandled error events and provide actionable diagnostics.
  client.on("error", (err) => {
    console.error(`[${label}] connection error (${url}):`, err)
  })

  return client
}

/** Shared Redis client for general use (pub, get/set, etc.) */
export const redis = buildRedisClient("redis")

/**
 * Creates a dedicated subscriber connection.
 * Each SSE stream needs its own subscriber because a subscribed client
 * can only receive messages, not issue other commands.
 */
export function createSubscriber(): Redis {
  return buildRedisClient("subscriber")
}

/** Redis channel name for per-user notification push. */
export function notificationChannel(userId: string): string {
  return `notifications:${userId}`
}
