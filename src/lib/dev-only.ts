import { NextResponse } from "next/server";

/**
 * Test/dev-only endpoints (mock-* scaffolding) must never be reachable in a
 * production deployment. Call at the top of such a route handler:
 *
 *   const blocked = devOnlyGuard();
 *   if (blocked) return blocked;
 *
 * Returns a 404 response when NODE_ENV === "production" (so the endpoint is
 * invisible in prod), otherwise null (handler proceeds normally in dev/test).
 */
export function devOnlyGuard(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
