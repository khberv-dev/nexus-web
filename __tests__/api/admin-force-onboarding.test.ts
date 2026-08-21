/**
 * Админ закрывает шаг онбординга, который дизайнер не прошёл
 * (PATCH /api/admin/specialists/[id]/onboarding).
 */

import {NextRequest} from "next/server";
import {makeReq, SESSION_ADMIN, SESSION_SPECIALIST} from "../helpers/api";

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getServerSessionWithDevBypass: jest.fn(),
    getSessionDbUser: jest.fn(),
}));
jest.mock("@/lib/db/prisma", () => ({
    prisma: {
        specialistProfile: {findUnique: jest.fn(), update: jest.fn()},
        onboardingStep: {findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn()},
        user: {findUnique: jest.fn().mockResolvedValue({id: "admin-db-1"})},
        auditLog: {create: jest.fn()},
    },
}));
jest.mock("@/lib/onboarding/notify-step", () => ({notifySpecialistStep: jest.fn()}));

import {getSessionUser} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

const mockSession = getSessionUser as jest.Mock;
const db = prisma as unknown as {
    specialistProfile: { findUnique: jest.Mock; update: jest.Mock };
    onboardingStep: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; create: jest.Mock };
    auditLog: { create: jest.Mock };
};

const PROFILE = {
    id: "profile-1",
    userId: "spec-1",
    onboardingStatus: "REGULATIONS",
    specialistContractStatus: "NONE",
};

describe("admin advances onboarding past an unfinished step", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    const params = {params: Promise.resolve({id: "spec-1"})};

    beforeAll(async () => {
        ({PATCH} = await import("@/app/api/admin/specialists/[id]/onboarding/route"));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.mockResolvedValue(SESSION_ADMIN.user);
        db.specialistProfile.findUnique.mockResolvedValue({...PROFILE});
        db.specialistProfile.update.mockResolvedValue({
            ...PROFILE,
            onboardingStatus: "CONTRACT",
            userId: "spec-1",
            user: {email: "spec@test.com"},
        });
        db.onboardingStep.findMany.mockResolvedValue([]);
    });

    test("regulations quiz unfinished no longer returns 409", async () => {
        // Именно этот случай раньше отдавал «специалист ещё не завершил тест регламентов».
        db.onboardingStep.findFirst.mockResolvedValue({id: "step-reg", type: "REGULATIONS", status: "IN_PROGRESS"});

        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect(res.status).toBe(200);

        const body = await res.json() as { status: string; forcedSteps: string[] };
        expect(body.status).toBe("CONTRACT");
        expect(body.forcedSteps).toEqual(["REGULATIONS"]);
    });

    test("a missing step record is forced too", async () => {
        db.onboardingStep.findFirst.mockResolvedValue(null);

        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect(res.status).toBe(200);
        expect((await res.json() as { forcedSteps: string[] }).forcedSteps).toEqual(["REGULATIONS"]);
    });

    test("a genuinely passed step is not reported as forced", async () => {
        db.onboardingStep.findFirst.mockResolvedValue({id: "step-reg", type: "REGULATIONS", status: "PASSED"});

        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect((await res.json() as { forcedSteps: string[] }).forcedSteps).toEqual([]);
    });

    test("an unsigned contract no longer blocks leaving the CONTRACT stage", async () => {
        db.specialistProfile.findUnique.mockResolvedValue({
            ...PROFILE,
            onboardingStatus: "CONTRACT",
            specialistContractStatus: "AWAITING_SIGNATURE",
        });
        db.onboardingStep.findFirst.mockResolvedValue({id: "step-c", type: "CONTRACT", status: "PASSED"});

        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect(res.status).toBe(200);
        expect((await res.json() as { forcedSteps: string[] }).forcedSteps).toContain("CONTRACT_SIGNATURE");
    });

    test("forced steps land in the audit log", async () => {
        db.onboardingStep.findFirst.mockResolvedValue(null);
        await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);

        expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "specialist_advanced",
                changes: expect.objectContaining({forcedSteps: {to: "REGULATIONS"}}),
            }),
        }));
    });

    test("still refuses a non-admin", async () => {
        mockSession.mockResolvedValue(SESSION_SPECIALIST.user);
        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect(res.status).toBe(403);
    });
});
