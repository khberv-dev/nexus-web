/**
 * Security-guard regression tests:
 *   SEC6 — DaData proxy requires auth (was anonymous)
 *   SEC3 — demo/login refuses ADMIN in production
 */
import { NextRequest } from "next/server";
import { makeReq } from "../helpers/api";

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findFirst: jest.fn(), upsert: jest.fn() }, specialistProfile: { upsert: jest.fn() }, clientProfile: { upsert: jest.fn() } },
}));

import { getSessionUser } from "@/lib/session";
const mockGetSessionUser = getSessionUser as jest.Mock;

describe("SEC6 — DaData proxy requires auth", () => {
  let bankPOST: (req: NextRequest) => Promise<Response>;
  let partyPOST: (req: NextRequest) => Promise<Response>;
  beforeAll(async () => {
    bankPOST = (await import("@/app/api/dadata/bank/route")).POST;
    partyPOST = (await import("@/app/api/dadata/party/route")).POST;
  });
  beforeEach(() => jest.clearAllMocks());

  test("bank: unauthenticated → 401", async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await bankPOST(makeReq("/api/dadata/bank", "POST", { bik: "044525225" }));
    expect(res.status).toBe(401);
  });

  test("party: unauthenticated → 401", async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await partyPOST(makeReq("/api/dadata/party", "POST", { inn: "7707083893" }));
    expect(res.status).toBe(401);
  });

  test("bank: authenticated but missing bik → 400 (auth passed, no external call)", async () => {
    mockGetSessionUser.mockResolvedValue({ id: "u1", email: "u@t", name: null, role: "SPECIALIST" });
    const res = await bankPOST(makeReq("/api/dadata/bank", "POST", {}));
    expect(res.status).toBe(400);
  });
});

describe("SEC3 — demo/login refuses ADMIN in production", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  // process.env.NODE_ENV is typed readonly; cast to a mutable view for the test.
  const env = process.env as Record<string, string | undefined>;
  const origEnv = env.NODE_ENV;
  const origKey = env.DEMO_ACCESS_KEY;
  beforeAll(async () => { POST = (await import("@/app/api/demo/login/route")).POST; });
  beforeEach(() => { env.DEMO_ACCESS_KEY = "secret-key"; });
  afterEach(() => { env.NODE_ENV = origEnv; env.DEMO_ACCESS_KEY = origKey; });

  test("ADMIN role in production → 403", async () => {
    env.NODE_ENV = "production";
    const res = await POST(makeReq("/api/demo/login", "POST", { key: "secret-key", role: "ADMIN" }));
    expect(res.status).toBe(403);
  });

  test("wrong key → 403", async () => {
    const res = await POST(makeReq("/api/demo/login", "POST", { key: "wrong", role: "CLIENT" }));
    expect(res.status).toBe(403);
  });
});
