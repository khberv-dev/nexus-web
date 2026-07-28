import type { NextRequest } from "next/server"

type Bucket = { count: number; resetAt: number }

/** In-memory store — persists across requests within the same Node.js process. */
const store = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/**
 * Fixed-window rate limiter.
 * @param key       Unique key per subject (e.g. `ai:<userId>`, `dadata:<ip>`)
 * @param limit     Max requests allowed per window
 * @param windowMs  Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

/** Extract client IP from standard proxy headers. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}
