/**
 * Functional tests: Order assignment flow
 *
 * Covers:
 *  1. Admin assigns specialist to order → creates project stages
 *  2. Re-assigning to already-assigned order does not duplicate stages
 *  3. Auth guards (non-ADMIN cannot assign)
 *  4. Admin moderates brief (approve / reject)
 */

import { NextRequest } from "next/server";
import { makeReq, SESSION_ADMIN, SESSION_SPECIALIST, SESSION_CLIENT } from "../helpers/api";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    projectStage: { findMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock("@/lib/audit", () => ({
  audit: jest.fn(),
  diff: jest.fn().mockReturnValue(null),
}));
jest.mock("@/lib/notifications", () => ({
  notify: jest.fn(),
}));

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit";

const mockGetSessionUser = getSessionUser as jest.Mock;
const mockPrisma         = prisma         as jest.Mocked<typeof prisma>;
const mockAudit          = audit          as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORDER_ID      = "order-001";
const SPECIALIST_ID = "specialist-user-001";
const ADMIN_DB_ID   = "admin-user-001";

const fakeOrder = {
  id: ORDER_ID,
  status: "BRIEF_REVIEW",
  clientId: "client-001",
  specialistId: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Order assignment flow", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudit.mockResolvedValue(undefined);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: ADMIN_DB_ID });
  });

  describe("PATCH /api/admin/orders/[id]/assign", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ PATCH } = await import("@/app/api/admin/orders/[id]/assign/route"));
    });

    const params = { params: Promise.resolve({ id: ORDER_ID }) };

    test("ADMIN assigns specialist and creates 3 project stages", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ id: ORDER_ID, status: "BRIEF_REVIEW" });
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...fakeOrder, specialistId: SPECIALIST_ID, status: "BRIEF_REVIEW" });
      (mockPrisma.projectStage.findMany as jest.Mock).mockResolvedValue([]); // no stages yet
      (mockPrisma.projectStage.createMany as jest.Mock).mockResolvedValue({ count: 3 });
      (mockPrisma.projectStage.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/assign`, "PATCH", { specialistId: SPECIALIST_ID }),
        params,
      );

      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean };
      expect(body.ok).toBe(true);

      // Must create all 3 stages
      expect(mockPrisma.projectStage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ type: "PLANNING" }),
          expect.objectContaining({ type: "VISUALIZATION" }),
          expect.objectContaining({ type: "DOCUMENTATION" }),
        ]),
      });
    });

    test("does NOT duplicate stages if already created", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ id: ORDER_ID, status: "BRIEF_REVIEW" });
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...fakeOrder, specialistId: SPECIALIST_ID });
      (mockPrisma.projectStage.findMany as jest.Mock).mockResolvedValue([
        { id: "stage-0", type: "CONCEPT" },
        { id: "stage-1", type: "PLANNING" },
        { id: "stage-2", type: "VISUALIZATION" },
        { id: "stage-3", type: "DOCUMENTATION" },
        { id: "stage-4", type: "SPECIFICATION" },
      ]);
      (mockPrisma.projectStage.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/assign`, "PATCH", { specialistId: SPECIALIST_ID }),
        params,
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.projectStage.createMany).not.toHaveBeenCalled();
    });

    test("returns 403 for SPECIALIST role", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/assign`, "PATCH", { specialistId: SPECIALIST_ID }),
        params,
      );
      expect(res.status).toBe(403);
    });

    test("returns 403 for CLIENT role", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/assign`, "PATCH", { specialistId: SPECIALIST_ID }),
        params,
      );
      expect(res.status).toBe(403);
    });

    test("records audit log on successful assignment", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ id: ORDER_ID, status: "BRIEF_REVIEW" });
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...fakeOrder, specialistId: SPECIALIST_ID });
      (mockPrisma.projectStage.findMany as jest.Mock).mockResolvedValue([{ id: "s1" }]);
      (mockPrisma.projectStage.findFirst as jest.Mock).mockResolvedValue(null);

      await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/assign`, "PATCH", { specialistId: SPECIALIST_ID }),
        params,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        ADMIN_DB_ID,
        "specialist_assigned",
        "Order",
        ORDER_ID,
        expect.objectContaining({ specialistId: expect.objectContaining({ to: SPECIALIST_ID }) }),
      );
    });
  });

  // ── Admin brief moderation ────────────────────────────────────────────────

  describe("PATCH /api/admin/orders/[id]/brief — brief moderation", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ PATCH } = await import("@/app/api/admin/orders/[id]/brief/route"));
    });

    const params = { params: Promise.resolve({ id: ORDER_ID }) };

    test("ADMIN can approve brief", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(fakeOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...fakeOrder, status: "BRIEF_APPROVED" });

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/brief`, "PATCH", { action: "approve" }),
        params,
      );
      expect(res.status).toBe(200);
    });

    test("returns 403 for non-ADMIN", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);

      const res = await PATCH(
        makeReq(`/api/admin/orders/${ORDER_ID}/brief`, "PATCH", { action: "approve" }),
        params,
      );
      expect(res.status).toBe(403);
    });
  });
});
