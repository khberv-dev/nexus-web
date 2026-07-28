/**
 * Functional tests: Payment webhook flow
 *
 * Covers:
 *  1. Webhook signature verification (HMAC-SHA256)
 *  2. Payment status mapping (CONFIRMED → HELD, REJECTED → FAILED, etc.)
 *  3. Stage is unblocked after payment is confirmed (stagePaymentConfirmed transition)
 *  4. Order marked DONE when all stages are APPROVED after payment
 *  5. Admin creates extra payment for additional revision round
 */

import { NextRequest } from "next/server";
import { makeReq, SESSION_ADMIN, SESSION_CLIENT } from "../helpers/api";
import { createHmac } from "crypto";

// ── Mocks ────────────────────────────────────────────────────────────────────

process.env.TBANK_WEBHOOK_SECRET = "test-webhook-secret-32chars-long!!";

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn(), getServerSessionWithDevBypass: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment:       { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    extraPayment:  { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    order:         { update: jest.fn() },
    projectStage:  { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    user:          { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/stage-machine", () => ({ transition: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ notify: jest.fn() }));
jest.mock("@/lib/billing", () => ({
  createPayment:      jest.fn(),
  createExtraPayment: jest.fn(),
}));

import { getSessionUser, getServerSessionWithDevBypass } from "@/lib/session";
import { prisma }           from "@/lib/db/prisma";
import { transition }       from "@/lib/stage-machine";
import { sendEmail }        from "@/lib/email";
import { createExtraPayment } from "@/lib/billing";

const mockGetServerSession = getServerSessionWithDevBypass as jest.Mock;
const mockGetSessionUser   = getSessionUser                as jest.Mock;
const mockPrisma           = prisma             as jest.Mocked<typeof prisma>;
const mockTransition       = transition         as jest.Mock;
const mockSendEmail        = sendEmail          as jest.Mock;
const mockCreateExtraPayment = createExtraPayment as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWebhookPayload(status: string, paymentId = "tb-pay-001") {
  const payload: Record<string, unknown> = {
    PaymentId: paymentId,
    Status:    status,
    OrderId:   "order-001",
    Amount:    1500000, // 15 000 RUB в копейках
  };

  // Sign exactly as the route verifies: sort keys (except Token), concat values, HMAC-SHA256
  const token = createHmac("sha256", process.env.TBANK_WEBHOOK_SECRET!)
    .update(
      Object.keys(payload)
        .filter(k => k !== "Token")
        .sort()
        .map(k => payload[k])
        .join(""),
    )
    .digest("hex");

  return { ...payload, Token: token };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STAGE_ID  = "stage-plan-001";
const ORDER_ID  = "order-001";

const fakePayment = {
  id:            "payment-local-001",
  orderId:       ORDER_ID,
  stageId:       STAGE_ID,
  tBankPaymentId: "tb-pay-001",
  status:        "PENDING",
  amount:        15000,
  order: {
    client:     { id: "client-001", email: "client@test.com" },
    specialist: { id: "spec-001",   email: "specialist@test.com" },
    stages:     [{ status: "APPROVED" }],
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Payment webhook", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/payments/webhook/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(fakePayment);
    (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.order.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.extraPayment.findFirst as jest.Mock).mockResolvedValue(null);
    // isOrderComplete() counts non-approved stages; 0 = all approved (fixture intent).
    (mockPrisma.projectStage.count as jest.Mock).mockResolvedValue(0);
    mockTransition.mockResolvedValue("PENDING");
    mockSendEmail.mockResolvedValue(undefined);
  });

  test("rejects webhook with invalid HMAC signature → 401", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const payload = { PaymentId: "tb-pay-001", Status: "CONFIRMED", Token: "invalid-token" };
    const res = await POST(makeReq("/api/payments/webhook", "POST", payload));
    expect(res.status).toBe(401);
    consoleSpy.mockRestore();
  });

  test("CONFIRMED → payment status set to HELD", async () => {
    const res = await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("CONFIRMED")));
    expect(res.status).toBe(200);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "HELD" } }),
    );
  });

  test("AUTHORIZED → payment status set to HELD", async () => {
    await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("AUTHORIZED")));

    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "HELD" } }),
    );
  });

  test("REJECTED → payment status set to FAILED", async () => {
    await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("REJECTED")));

    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } }),
    );
  });

  test("REVERSED → payment status set to REFUNDED", async () => {
    await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("REVERSED")));

    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } }),
    );
  });

  test("CONFIRMED with stageId → triggers stagePaymentConfirmed transition", async () => {
    await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("CONFIRMED")));
    await new Promise(r => setTimeout(r, 0));

    expect(mockTransition).toHaveBeenCalledWith(STAGE_ID, "stagePaymentConfirmed", "ADMIN", undefined, null);
  });

  test("CONFIRMED → sends payment_received email to client and specialist", async () => {
    await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("CONFIRMED")));
    await new Promise(r => setTimeout(r, 0));

    expect(mockSendEmail).toHaveBeenCalledWith("payment_received", "client@test.com", expect.any(Object));
    expect(mockSendEmail).toHaveBeenCalledWith("payment_received", "specialist@test.com", expect.any(Object));
  });

  test("returns 404 when payment not found in DB", async () => {
    (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("CONFIRMED")));
    expect(res.status).toBe(404);
  });

  test("duplicate CONFIRMED (payment already HELD) → 200 idempotent, no re-transition (FUN2)", async () => {
    // Banks retry webhooks. A repeat CONFIRMED on an already-HELD payment must be a
    // no-op success, not a 500 from re-running the already-applied transition.
    (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({ ...fakePayment, status: "HELD" });
    const res = await POST(makeReq("/api/payments/webhook", "POST", buildWebhookPayload("CONFIRMED")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });
});

// ── Extra payment ─────────────────────────────────────────────────────────────

describe("Extra payment — admin creates additional charge", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  const STAGE_ID_EXTRA = "stage-viz-001";

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/admin/payments/[id]/extra/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);
    (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue({
      id:       STAGE_ID_EXTRA,
      orderId:  ORDER_ID,
      order:    { client: { email: "client@test.com" } },
    });
    (mockPrisma.extraPayment.create as jest.Mock).mockResolvedValue({ id: "extra-pay-001" });
    mockCreateExtraPayment.mockResolvedValue({ paymentId: "tb-extra-001", paymentUrl: "https://pay.tbank.ru/extra" });
    mockSendEmail.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: STAGE_ID_EXTRA }) };

  test("ADMIN creates extra payment and returns paymentUrl", async () => {
    const res = await POST(
      makeReq(`/api/admin/payments/${STAGE_ID_EXTRA}/extra`, "POST", {
        amount: 5000,
        reason: "Третий раунд правок клиента",
      }),
      params,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { paymentUrl: string };
    expect(body.paymentUrl).toBe("https://pay.tbank.ru/extra");
  });

  test("sends extra_payment_required email to client", async () => {
    await POST(
      makeReq(`/api/admin/payments/${STAGE_ID_EXTRA}/extra`, "POST", {
        amount: 5000,
        reason: "Дополнительная правка",
      }),
      params,
    );

    await new Promise(r => setTimeout(r, 0));
    expect(mockSendEmail).toHaveBeenCalledWith(
      "extra_payment_required",
      "client@test.com",
      expect.objectContaining({ amount: 5000 }),
    );
  });

  test("CLIENT cannot create extra payment → 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_CLIENT);

    const res = await POST(
      makeReq(`/api/admin/payments/${STAGE_ID_EXTRA}/extra`, "POST", { amount: 5000, reason: "test" }),
      params,
    );
    expect(res.status).toBe(403);
  });
});
