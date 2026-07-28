/**
 * Shared helpers for functional API route tests.
 *
 * Pattern:
 *  - Mock next-auth / session so we control role
 *  - Mock prisma so we don't need a real DB
 *  - Mock email/billing so external calls are no-ops
 *  - Build NextRequest with makeReq(), call the route handler, assert on NextResponse
 */

import { NextRequest } from "next/server";

// ── Session factories ────────────────────────────────────────────────────────

export const makeSession = (role: string, overrides: Record<string, unknown> = {}) => ({
  user: {
    id: `user-${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@test.com`,
    name: `Test ${role}`,
    role,
    ...overrides,
  },
});

export const SESSION_ADMIN     = makeSession("ADMIN");
export const SESSION_SPECIALIST = makeSession("SPECIALIST");
export const SESSION_CLIENT    = makeSession("CLIENT");

// ── Request factory ──────────────────────────────────────────────────────────

export function makeReq(
  url: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
  body?: unknown,
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Response assertion helpers ────────────────────────────────────────────────

export async function json(res: Response): Promise<unknown> {
  return res.json();
}
