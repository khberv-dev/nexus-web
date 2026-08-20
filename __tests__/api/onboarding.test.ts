/**
 * Functional tests: Specialist onboarding flow
 *
 * Covers:
 *  1. Specialist submits application (POST /api/onboarding/apply)
 *  2. Admin lists onboarding requests (GET /api/admin/onboarding)
 *  3. Admin changes onboarding status (PATCH /api/admin/onboarding/[id])
 *  4. Auth guards — non-ADMIN cannot change status
 */

import { NextRequest } from "next/server";
import { makeReq, SESSION_ADMIN, SESSION_SPECIALIST, SESSION_CLIENT } from "../helpers/api";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({ 
  getSessionUser: jest.fn(),
  getServerSessionWithDevBypass: jest.fn()
}));
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    specialistProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    notification: {
      create: jest.fn().mockResolvedValue({ 
        id: "notification-123",
        createdAt: new Date(),
        updatedAt: new Date()
      }),
    },
  },
}));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true, provider: "resend" }) }));
// Без этого notify() поднимает реальный ioredis-клиент: запрос виснет, а jest не завершается.
jest.mock("@/lib/notifications", () => ({ notify: jest.fn() }));

import { getSessionUser, getServerSessionWithDevBypass } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";

const mockGetServerSessionWithDevBypass = getServerSessionWithDevBypass as jest.Mock;
const mockGetSessionUser   = getSessionUser   as jest.Mock;
const mockPrisma           = prisma as jest.Mocked<typeof prisma>;
const mockSendEmail        = sendEmail        as jest.Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROFILE_ID = "profile-abc-123";

const fakeProfile = {
  id: PROFILE_ID,
  userId: SESSION_SPECIALIST.user.id,
  onboardingStatus: "PENDING",
  user: {
    id: SESSION_SPECIALIST.user.id,
    email: SESSION_SPECIALIST.user.email,
    name: SESSION_SPECIALIST.user.name,
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Onboarding flow", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Admin lists onboarding requests ──────────────────────────────────

  describe("GET /api/admin/onboarding — list pending specialists", () => {
    let GET: (req: NextRequest) => Promise<Response>;

    beforeAll(async () => {
      ({ GET } = await import("@/app/api/admin/onboarding/route"));
    });

    test("returns list for ADMIN", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_ADMIN);
      (mockPrisma.specialistProfile.findMany as jest.Mock).mockResolvedValue([fakeProfile]);

      const res = await GET(makeReq("/api/admin/onboarding", "GET"));
      expect(res.status).toBe(200);
      const body = await res.json() as unknown[];
      expect(body).toHaveLength(1);
    });

    test("returns 401 when unauthenticated", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(null);

      const res = await GET(makeReq("/api/admin/onboarding", "GET"));
      expect(res.status).toBe(401);
    });

    test("returns 403 for SPECIALIST role", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_SPECIALIST);

      const res = await GET(makeReq("/api/admin/onboarding", "GET"));
      expect(res.status).toBe(403);
    });
  });

  // ── 2. Admin changes onboarding status ──────────────────────────────────

  describe("PATCH /api/admin/onboarding/[id] — update status", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ PATCH } = await import("@/app/api/admin/onboarding/[id]/route"));
    });

    const params = { params: Promise.resolve({ id: PROFILE_ID }) };

    test("ADMIN can approve specialist (PENDING → TEST_INVITED)", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_ADMIN);
      // Гард последовательности: TEST_INVITED требует пройденный шаг FORM.
      (mockPrisma.specialistProfile.findUnique as jest.Mock).mockResolvedValue({
        ...fakeProfile,
        steps: [{ type: "FORM", status: "PASSED" }],
      });
      (mockPrisma.specialistProfile.update as jest.Mock).mockResolvedValue({
        ...fakeProfile,
        onboardingStatus: "TEST_INVITED",
      });

      const res = await PATCH(
        makeReq(`/api/admin/onboarding/${PROFILE_ID}`, "PATCH", { onboardingStatus: "TEST_INVITED" }),
        params,
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { onboardingStatus: string };
      expect(body.onboardingStatus).toBe("TEST_INVITED");
    });

    test("sends email notification after status change", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_ADMIN);
      // INTERVIEW_INVITED требует пройденные FORM и TEST.
      (mockPrisma.specialistProfile.findUnique as jest.Mock).mockResolvedValue({
        ...fakeProfile,
        steps: [
          { type: "FORM", status: "PASSED" },
          { type: "TEST", status: "PASSED" },
        ],
      });
      (mockPrisma.specialistProfile.update as jest.Mock).mockResolvedValue({
        ...fakeProfile,
        onboardingStatus: "INTERVIEW_INVITED",
      });

      await PATCH(
        makeReq(`/api/admin/onboarding/${PROFILE_ID}`, "PATCH", {
          onboardingStatus: "INTERVIEW_INVITED",
          comment: "Добро пожаловать на интервью",
        }),
        params,
      );

      await new Promise(r => setTimeout(r, 0));
      expect(mockSendEmail).toHaveBeenCalledWith(
        "onboarding_status",
        SESSION_SPECIALIST.user.email,
        expect.objectContaining({ status: "INTERVIEW_INVITED" }),
      );
    });

    test("returns 403 for CLIENT role", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_CLIENT);

      const res = await PATCH(
        makeReq(`/api/admin/onboarding/${PROFILE_ID}`, "PATCH", { onboardingStatus: "ACTIVE" }),
        params,
      );
      expect(res.status).toBe(403);
    });

    test("returns 401 when not authenticated", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(null);

      const res = await PATCH(
        makeReq(`/api/admin/onboarding/${PROFILE_ID}`, "PATCH", { onboardingStatus: "ACTIVE" }),
        params,
      );
      expect(res.status).toBe(401);
    });
  });

  // ── 3. Admin can reject specialist ──────────────────────────────────────

  describe("PATCH /api/admin/onboarding/[id] — rejection", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

    beforeAll(async () => {
      ({ PATCH } = await import("@/app/api/admin/onboarding/[id]/route"));
    });

    test("ADMIN can reject specialist", async () => {
      mockGetServerSessionWithDevBypass.mockResolvedValue(SESSION_ADMIN);
      (mockPrisma.specialistProfile.update as jest.Mock).mockResolvedValue({
        ...fakeProfile,
        onboardingStatus: "REJECTED",
      });

      const res = await PATCH(
        makeReq(`/api/admin/onboarding/${PROFILE_ID}`, "PATCH", {
          onboardingStatus: "REJECTED",
          comment: "Портфолио не соответствует требованиям",
        }),
        { params: Promise.resolve({ id: PROFILE_ID }) },
      );

      expect(res.status).toBe(200);
      const body = await res.json() as { onboardingStatus: string };
      expect(body.onboardingStatus).toBe("REJECTED");
    });
  });
});
