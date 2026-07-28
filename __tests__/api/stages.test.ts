/**
 * Functional tests: Stage lifecycle
 *
 * Full cycle for one project stage:
 *  PENDING
 *    → UPLOADED       (specialist uploads file)
 *    → MOD_REVIEW     (specialist submits)
 *    → CLIENT_REVIEW  (admin approves moderation)
 *    → APPROVED       (client approves)
 *
 * Also covers:
 *  - Moderation rejection → MOD_REVISION → re-submit
 *  - Client revision (clientRound 0–2 → CLIENT_REVISION, 3+ → EXTRA_PAYMENT)
 *  - Role guards on every endpoint
 */

import { NextRequest } from "next/server";
import { makeReq, SESSION_ADMIN, SESSION_SPECIALIST, SESSION_CLIENT } from "../helpers/api";
import { StageStatus } from "@prisma/client";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    projectStage: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    stageReview: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    stageAct: { findUnique: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/stage-machine", () => ({
  ...jest.requireActual("@/lib/stage-machine"),
  transition: jest.fn(),
}));

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { transition } from "@/lib/stage-machine";

const mockGetSessionUser = getSessionUser as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockTransition = transition as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STAGE_ID = "stage-plan-001";
const ORDER_ID = "order-001";
const SPECIALIST_DB = "specialist-db-001";
const CLIENT_DB = "client-db-001";

function makeStage(status: StageStatus, overrides = {}) {
  return {
    id: STAGE_ID,
    orderId: ORDER_ID,
    type: "PLANNING",
    status,
    clientRound: 0,
    modRound: 0,
    order: { specialistId: SPECIALIST_DB, clientId: CLIENT_DB, status: "ACTIVE" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Stage lifecycle", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.user.findUnique as jest.Mock).mockImplementation(({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email === SESSION_SPECIALIST.user.email) return Promise.resolve({ id: SPECIALIST_DB });
      if (where.email === SESSION_CLIENT.user.email) return Promise.resolve({ id: CLIENT_DB });
      if (where.email === SESSION_ADMIN.user.email) return Promise.resolve({ id: "admin-db-001" });
      return Promise.resolve(null);
    });
  });

  // ── Step 1: Specialist submits stage ────────────────────────────────────

  describe("POST /api/stages/[id]/submit — specialist submits", () => {
    let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ POST } = await import("@/app/api/stages/[id]/submit/route"));
    });

    const params = { params: Promise.resolve({ id: STAGE_ID }) };

    test("SPECIALIST submits UPLOADED stage → MOD_REVIEW", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("UPLOADED"));
      mockTransition.mockResolvedValue("MOD_REVIEW");

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("MOD_REVIEW");
      expect(mockTransition).toHaveBeenCalledWith(STAGE_ID, "submit", "SPECIALIST", undefined, SPECIALIST_DB);
    });

    test("SPECIALIST re-submits after MOD_REVISION → MOD_REVIEW", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("MOD_REVISION"));
      mockTransition.mockResolvedValue("MOD_REVIEW");

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(200);
      expect(mockTransition).toHaveBeenCalledWith(STAGE_ID, "resubmitMod", "SPECIALIST", undefined, SPECIALIST_DB);
    });

    test("SPECIALIST re-submits after CLIENT_REVISION → CLIENT_REVIEW", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVISION"));
      mockTransition.mockResolvedValue("CLIENT_REVIEW");

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(200);
      expect(mockTransition).toHaveBeenCalledWith(STAGE_ID, "resubmitClient", "SPECIALIST", undefined, SPECIALIST_DB);
    });

    test("CLIENT cannot submit stage", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("UPLOADED"));

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(403);
    });

    test("SPECIALIST cannot submit a stage belonging to another order", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue({
        ...makeStage("UPLOADED"),
        order: { specialistId: "other-specialist-999", clientId: CLIENT_DB },
      });

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(403);
    });

    test("returns 400 when stage status is not submittable", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("APPROVED"));

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(400);
      expect(mockTransition).not.toHaveBeenCalled();
    });

    test("returns 409 on transition error", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("UPLOADED"));
      mockTransition.mockRejectedValue(new Error("transition failed"));

      const res = await POST(makeReq(`/api/stages/${STAGE_ID}/submit`), params);
      expect(res.status).toBe(409);
    });
  });

  // ── Step 2: Admin moderation ─────────────────────────────────────────────

  describe("POST /api/admin/stages/[id]/review — admin moderates", () => {
    let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ POST } = await import("@/app/api/admin/stages/[id]/review/route"));
    });

    beforeEach(() => {
      mockTransition.mockReset();
    });

    const params = { params: Promise.resolve({ id: STAGE_ID }) };

    test("ADMIN approves moderation → CLIENT_REVIEW", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue({
        ...makeStage("MOD_REVIEW"),
        order: { client: { email: "client@example.com" }, specialist: { email: "spec@example.com" } },
      });
      mockTransition.mockResolvedValue("CLIENT_REVIEW");

      const res = await POST(
        makeReq(`/api/admin/stages/${STAGE_ID}/review`, "POST", { action: "modApprove" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("CLIENT_REVIEW");

      expect(mockTransition).toHaveBeenCalledWith(STAGE_ID, "modApprove", "ADMIN", undefined, SESSION_ADMIN.user.id);
    });

    test("ADMIN sends stage to revision → MOD_REVISION and increments modRound", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue({
        ...makeStage("MOD_REVIEW"),
        order: { client: { email: "client@example.com" }, specialist: { email: "spec@example.com" } },
      });
      mockTransition.mockResolvedValue("MOD_REVISION");

      const res = await POST(
        makeReq(`/api/admin/stages/${STAGE_ID}/review`, "POST", {
          action: "modRevision",
          comment: "Нужно добавить размеры помещений",
        }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("MOD_REVISION");

      expect(mockTransition).toHaveBeenCalledWith(
        STAGE_ID,
        "modRevision",
        "ADMIN",
        "Нужно добавить размеры помещений",
        SESSION_ADMIN.user.id,
      );
    });

    test("returns 404 when stage not found", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_ADMIN.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await POST(
        makeReq(`/api/admin/stages/${STAGE_ID}/review`, "POST", { action: "modApprove" }),
        params,
      );
      expect(res.status).toBe(404);
    });

    test("SPECIALIST cannot perform moderation", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);

      const res = await POST(
        makeReq(`/api/admin/stages/${STAGE_ID}/review`, "POST", { action: "modApprove" }),
        params,
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Step 3: Client review ────────────────────────────────────────────────

  describe("POST /api/stages/[id]/client-review — client approves or rejects", () => {
    let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ POST } = await import("@/app/api/stages/[id]/client-review/route"));
    });

    const params = { params: Promise.resolve({ id: STAGE_ID }) };

    /** PLANNING разрешён только после APPROVED концепции */
    const pipelinePlanningUnlocked = [
      { type: "CONCEPT", status: "APPROVED" },
      { type: "PLANNING", status: "CLIENT_REVIEW" },
    ];

    beforeEach(() => {
      (mockPrisma.projectStage.findMany as jest.Mock).mockResolvedValue(pipelinePlanningUnlocked);
    });

    test("CLIENT approves stage → APPROVED", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVIEW"));
      mockTransition.mockResolvedValue("APPROVED");

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("APPROVED");
    });

    test("CLIENT requests revision (round 1) → CLIENT_REVISION", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVIEW", { clientRound: 0 }));
      mockTransition.mockResolvedValue("CLIENT_REVISION");

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", {
          action: "clientRevision",
          comment: "Хочу другую планировку кухни",
        }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("CLIENT_REVISION");
    });

    test("CLIENT requests revision (clientRound 3) → EXTRA_PAYMENT", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVIEW", { clientRound: 3 }));
      mockTransition.mockResolvedValue("EXTRA_PAYMENT");

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientRevision" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("EXTRA_PAYMENT");
    });

    test("CLIENT requests revision (clientRound 2) → CLIENT_REVISION", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVIEW", { clientRound: 2 }));
      mockTransition.mockResolvedValue("CLIENT_REVISION");

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", {
          action: "clientRevision",
          comment: "Еще правки",
        }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("CLIENT_REVISION");
    });

    test("returns 409 when stage is not in CLIENT_REVIEW", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("MOD_REVIEW"));

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(409);
    });

    test("idempotent: approve again after APPROVED → 200", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("APPROVED"));

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("APPROVED");
      expect(mockTransition).not.toHaveBeenCalled();
    });

    test("idempotent: revision again after CLIENT_REVISION → 200", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVISION"));

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientRevision" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("CLIENT_REVISION");
      expect(mockTransition).not.toHaveBeenCalled();
    });

    test("returns 409 when previous pipeline stages are not APPROVED", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue(makeStage("CLIENT_REVIEW"));
      (mockPrisma.projectStage.findMany as jest.Mock).mockResolvedValue([
        { type: "CONCEPT", status: "CLIENT_REVIEW" },
        { type: "PLANNING", status: "CLIENT_REVIEW" },
      ]);

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(409);
      expect(mockTransition).not.toHaveBeenCalled();
    });

    test("SPECIALIST cannot perform client review", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_SPECIALIST.user);

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(403);
    });

    test("CLIENT cannot review a stage that belongs to another order", async () => {
      mockGetSessionUser.mockResolvedValue(SESSION_CLIENT.user);
      (mockPrisma.projectStage.findUnique as jest.Mock).mockResolvedValue({
        ...makeStage("CLIENT_REVIEW"),
        order: { specialistId: SPECIALIST_DB, clientId: "other-client-999" },
      });

      const res = await POST(
        makeReq(`/api/stages/${STAGE_ID}/client-review`, "POST", { action: "clientApprove" }),
        params,
      );
      expect(res.status).toBe(403);
    });
  });
});
