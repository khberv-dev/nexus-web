/**
 * Functional tests: admin payment release route.
 * Locks in the Bosqich 0/1 money fixes:
 *   FUN5   — releasePayment gets tBankPaymentId (not orderId)
 *   FUN4   — atomic claim (updateMany where status=HELD) → no double payout
 *   EXTRA4 — only HELD funds may be released (non-HELD rejected)
 *   FUN6   — order marked DONE via isOrderComplete, only after a real release
 */
import { NextRequest } from "next/server";
import { makeReq } from "../helpers/api";

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    order: { update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/billing", () => ({ releasePayment: jest.fn() }));
jest.mock("@/lib/audit", () => ({ audit: jest.fn() }));
jest.mock("@/lib/order-completion", () => ({ isOrderComplete: jest.fn() }));

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { releasePayment } from "@/lib/billing";
import { isOrderComplete } from "@/lib/order-completion";

const mockGetSessionUser = getSessionUser as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRelease = releasePayment as jest.Mock;
const mockIsComplete = isOrderComplete as jest.Mock;

const params = { params: Promise.resolve({ id: "pay-1" }) };
const HELD = { id: "pay-1", orderId: "ord-1", status: "HELD", tBankPaymentId: "tb-1" };
const url = "/api/admin/payments/pay-1/release";

describe("Admin payment release", () => {
  let POST: (req: NextRequest, ctx: typeof params) => Promise<Response>;
  beforeAll(async () => { ({ POST } = await import("@/app/api/admin/payments/[id]/release/route")); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUser.mockResolvedValue({ id: "admin-1", email: "admin@test.com", name: null, role: "ADMIN" });
    (mockPrisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.order.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "admin-1" });
    mockRelease.mockResolvedValue(undefined);
    mockIsComplete.mockResolvedValue(false);
  });

  test("non-ADMIN → 403", async () => {
    mockGetSessionUser.mockResolvedValue({ id: "c", email: "c@t", name: null, role: "CLIENT" });
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(403);
  });

  test("HELD → releasePayment(tBankPaymentId) via atomic claim (FUN5 + FUN4)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(HELD);
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(200);
    expect(mockRelease).toHaveBeenCalledWith("tb-1"); // FUN5: billing id, not orderId
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay-1", status: "HELD" }, data: { status: "RELEASED" } }),
    );
  });

  test("PENDING (uncaptured) → 409, no payout (EXTRA4)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({ ...HELD, status: "PENDING" });
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(409);
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
  });

  test("already RELEASED → 200 idempotent, no double payout (FUN4)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({ ...HELD, status: "RELEASED" });
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, alreadyReleased: true });
    expect(mockRelease).not.toHaveBeenCalled();
  });

  test("concurrent race loser (claim count 0) → no double payout (FUN4)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(HELD);
    (mockPrisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(200);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  test("billing failure → rollback to HELD, 502, order NOT completed", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(HELD);
    mockRelease.mockRejectedValue(new Error("billing down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(502);
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay-1" }, data: { status: "HELD" } }),
    );
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("HELD but tBankPaymentId null → 409, no payout (FUN5 guard)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({ ...HELD, tBankPaymentId: null });
    const res = await POST(makeReq(url, "POST"), params);
    expect(res.status).toBe(409);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  test("order marked DONE only after a real release + all stages approved (FUN6)", async () => {
    (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(HELD);
    mockIsComplete.mockResolvedValue(true);
    await POST(makeReq(url, "POST"), params);
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ord-1" }, data: { status: "DONE" } }),
    );
  });
});
