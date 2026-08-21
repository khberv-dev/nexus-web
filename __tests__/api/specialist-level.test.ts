/**
 * Functional tests: admin grants a qualification level without the test
 * (POST /api/admin/specialists/[id]/level)
 */

import {NextRequest} from "next/server";
import {makeReq, SESSION_ADMIN, SESSION_SPECIALIST} from "../helpers/api";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getServerSessionWithDevBypass: jest.fn(),
    getSessionDbUser: jest.fn(),
}));
jest.mock("@/lib/db/prisma", () => {
    const tx = {
        onboardingStep: {update: jest.fn(), create: jest.fn()},
        specialistProfile: {update: jest.fn()},
    };
    return {
        __tx: tx,
        prisma: {
            specialistProfile: {findUnique: jest.fn(), update: jest.fn()},
            onboardingStep: {update: jest.fn(), create: jest.fn()},
            user: {findUnique: jest.fn().mockResolvedValue({id: "admin-db-1"})},
            auditLog: {create: jest.fn()},
            $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
        },
    };
});
jest.mock("@/lib/onboarding/notify-step", () => ({notifySpecialistStep: jest.fn()}));

import {getSessionUser} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {notifySpecialistStep} from "@/lib/onboarding/notify-step";

const mockSession = getSessionUser as jest.Mock;
const mockPrisma = prisma as unknown as {
    specialistProfile: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tx = (require("@/lib/db/prisma") as { __tx: { onboardingStep: { update: jest.Mock; create: jest.Mock }; specialistProfile: { update: jest.Mock } } }).__tx;
const mockNotify = notifySpecialistStep as jest.Mock;

const PROFILE = {
    id: "profile-1",
    userId: "spec-1",
    onboardingStatus: "TEST_INVITED",
    steps: [{id: "step-test", type: "TEST", status: "IN_PROGRESS", comment: null}],
    user: {email: "spec@test.com", archivedAt: null},
};

function savedState(): { passedLevels: string[]; adminBypass: { reason: string | null } | null; currentLevel: string } {
    const arg = tx.onboardingStep.update.mock.calls[0][0] as { data: { comment: string } };
    return JSON.parse(arg.data.comment);
}

describe("POST /api/admin/specialists/[id]/level", () => {
    let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    const params = {params: Promise.resolve({id: "spec-1"})};

    beforeAll(async () => {
        ({POST} = await import("@/app/api/admin/specialists/[id]/level/route"));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.mockResolvedValue(SESSION_ADMIN.user);
        mockPrisma.specialistProfile.findUnique.mockResolvedValue({...PROFILE});
    });

    test("rejects non-admin", async () => {
        mockSession.mockResolvedValue(SESSION_SPECIALIST.user);
        const res = await POST(makeReq("/x", "POST", {level: "L3"}), params);
        expect(res.status).toBe(403);
    });

    test("rejects an unknown level", async () => {
        const res = await POST(makeReq("/x", "POST", {level: "L9"}), params);
        expect(res.status).toBe(400);
    });

    test("levels are cumulative: L3 marks L1-L3 passed and keeps the test open", async () => {
        const res = await POST(makeReq("/x", "POST", {level: "L3", reason: "перевод из другой платформы"}), params);
        expect(res.status).toBe(200);

        const body = await res.json() as { level: string; passedLevels: string[]; testStepStatus: string };
        expect(body.level).toBe("L3");
        expect(body.passedLevels).toEqual(["L1", "L2", "L3"]);
        // Не все уровни выданы — шаг остаётся открытым, дизайнер может досдать L4.
        expect(body.testStepStatus).toBe("IN_PROGRESS");

        const state = savedState();
        expect(state.passedLevels).toEqual(["L1", "L2", "L3"]);
        expect(state.adminBypass?.reason).toBe("перевод из другой платформы");
        expect(tx.specialistProfile.update).not.toHaveBeenCalled();
    });

    test("granting L4 closes the test step and opens the interview", async () => {
        const res = await POST(makeReq("/x", "POST", {level: "L4"}), params);
        expect(res.status).toBe(200);

        const body = await res.json() as { passedLevels: string[]; testStepStatus: string; onboardingStatus: string };
        expect(body.passedLevels).toEqual(["L1", "L2", "L3", "L4"]);
        expect(body.testStepStatus).toBe("PASSED");
        expect(body.onboardingStatus).toBe("INTERVIEW_INVITED");
        expect(tx.specialistProfile.update).toHaveBeenCalledWith(
            expect.objectContaining({data: {onboardingStatus: "INTERVIEW_INVITED"}}),
        );
    });

    test("lowering the level strips the levels above it", async () => {
        mockPrisma.specialistProfile.findUnique.mockResolvedValue({
            ...PROFILE,
            onboardingStatus: "ACTIVE",
            steps: [{
                id: "step-test",
                type: "TEST",
                status: "PASSED",
                comment: JSON.stringify({
                    version: 5, phase: "level_finished", currentLevel: "L4", answers: {},
                    passedLevels: ["L1", "L2", "L3", "L4"], attempts: [{level: "L1"}],
                }),
            }],
        });

        const res = await POST(makeReq("/x", "POST", {level: "L2"}), params);
        expect(res.status).toBe(200);
        const body = await res.json() as { previousLevel: string; passedLevels: string[] };
        expect(body.previousLevel).toBe("L4");
        expect(body.passedLevels).toEqual(["L1", "L2"]);
        // Реальные попытки дизайнера не теряются.
        expect(savedState()).toMatchObject({passedLevels: ["L1", "L2"]});
    });

    test("keeps the specialist's real attempt history", async () => {
        mockPrisma.specialistProfile.findUnique.mockResolvedValue({
            ...PROFILE,
            steps: [{
                id: "step-test", type: "TEST", status: "IN_PROGRESS",
                comment: JSON.stringify({
                    version: 5, phase: "level_finished", currentLevel: "L1", answers: {},
                    passedLevels: [], attempts: [{level: "L1", passed: false, percent: 40}],
                }),
            }],
        });

        await POST(makeReq("/x", "POST", {level: "L1"}), params);
        const state = savedState() as unknown as { attempts: unknown[] };
        expect(state.attempts).toHaveLength(1);
    });

    test("notifies the specialist and writes an audit entry", async () => {
        await POST(makeReq("/x", "POST", {level: "L4"}), params);

        expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
            userId: "spec-1",
            status: "LEVEL_GRANTED",
            extra: expect.objectContaining({level: "L4", levelTitle: "Элита"}),
        }));
        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({action: "specialist_level_set", entityId: "spec-1"}),
        }));
    });

    test("refuses on PENDING and REJECTED onboarding", async () => {
        for (const onboardingStatus of ["PENDING", "REJECTED"]) {
            mockPrisma.specialistProfile.findUnique.mockResolvedValue({...PROFILE, onboardingStatus});
            const res = await POST(makeReq("/x", "POST", {level: "L2"}), params);
            expect(res.status).toBe(409);
        }
    });

    test("refuses for an archived specialist", async () => {
        mockPrisma.specialistProfile.findUnique.mockResolvedValue({
            ...PROFILE,
            user: {email: "spec@test.com", archivedAt: new Date()},
        });
        const res = await POST(makeReq("/x", "POST", {level: "L2"}), params);
        expect(res.status).toBe(409);
    });
});
