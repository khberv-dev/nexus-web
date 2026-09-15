/**
 * Письмо специалисту, когда администратор меняет онбординг вручную:
 * назначает квалификационный уровень (L1–L4) и переводит на следующий шаг.
 *
 * Отличие от specialist-level.test.ts / admin-force-onboarding.test.ts: там
 * notify-step замокан, поэтому факт письма не проверяется вообще. Здесь замокан
 * только транспорт — цепочка «роут → notifySpecialistStep → sendEmail → SMTP»
 * прогоняется целиком, включая адрес получателя и тему письма.
 */

import {NextRequest} from "next/server";
import {makeReq, SESSION_ADMIN, SESSION_SPECIALIST} from "../helpers/api";

const sendMail = jest.fn().mockResolvedValue({messageId: "smtp-1"});

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getServerSessionWithDevBypass: jest.fn(),
    getSessionDbUser: jest.fn(),
}));

// Почта «настроена» резервным SMTP: письмо рендерится по-настоящему,
// наружу уходит только этот мок.
jest.mock("@/lib/email-config", () => ({
    getResendApiKey: () => null,
    getSmtpConfig: () => ({host: "smtp.test", port: 587, secure: false, from: "NEXUS <noreply@test>"}),
    getSmtpTransport: () => ({sendMail}),
    getMailProvider: () => "smtp",
    resolveResendFrom: () => "NEXUS <noreply@test>",
    isMailEnabled: () => true,
    isPlaceholderResendKey: () => true,
}));

jest.mock("@/lib/redis", () => ({
    redis: {publish: jest.fn()},
    notificationChannel: (userId: string) => `notifications:${userId}`,
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
            onboardingStep: {findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn()},
            user: {findUnique: jest.fn().mockResolvedValue({id: "admin-db-1", email: "spec@test.com"})},
            auditLog: {create: jest.fn()},
            notification: {
                create: jest.fn().mockResolvedValue({
                    id: "notification-1",
                    type: "onboarding_status",
                    title: "t",
                    message: "m",
                    link: null,
                    createdAt: new Date(),
                }),
            },
            $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
        },
    };
});

import {getSessionUser} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

const mockSession = getSessionUser as jest.Mock;
const db = prisma as unknown as {
    specialistProfile: { findUnique: jest.Mock; update: jest.Mock };
    onboardingStep: { findFirst: jest.Mock; findMany: jest.Mock };
    notification: { create: jest.Mock };
};

type SentMail = { to: string; subject: string; html: string };
const lastMail = (): SentMail => sendMail.mock.calls.at(-1)?.[0] as SentMail;

const PROFILE = {
    id: "profile-1",
    userId: "spec-1",
    onboardingStatus: "TEST_INVITED",
    specialistContractStatus: "NONE",
    steps: [{id: "step-test", type: "TEST", status: "IN_PROGRESS", comment: null}],
    user: {email: "spec@test.com", archivedAt: null},
};

describe("админ назначает уровень → письмо специалисту", () => {
    let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    const params = {params: Promise.resolve({id: "spec-1"})};

    beforeAll(async () => {
        ({POST} = await import("@/app/api/admin/specialists/[id]/level/route"));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.mockResolvedValue(SESSION_ADMIN.user);
        db.specialistProfile.findUnique.mockResolvedValue({...PROFILE});
    });

    test.each([
        ["L1", "JUNIOR"],
        ["L2", "SENIOR"],
        ["L3", "MASTER"],
        ["L4", "ELITE"],
    ])("уровень %s уходит на почту специалиста с названием «%s»", async (level, title) => {
        const res = await POST(makeReq("/x", "POST", {level}), params);
        expect(res.status).toBe(200);

        expect(sendMail).toHaveBeenCalledTimes(1);
        const mail = lastMail();
        expect(mail.to).toBe("spec@test.com");
        expect(mail.subject).toBe(`Вам присвоен уровень «${title}»`);
        expect(mail.html).toContain(title);
        expect(mail.html).toContain(level);
    });

    test("причина от админа попадает в текст письма", async () => {
        await POST(makeReq("/x", "POST", {level: "L3", reason: "перевод из другой платформы"}), params);
        expect(lastMail().html).toContain("перевод из другой платформы");
    });

    test("письмо идёт вместе с in-app уведомлением, а не вместо него", async () => {
        await POST(makeReq("/x", "POST", {level: "L2"}), params);
        expect(db.notification.create).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    test("не-админ уровень не меняет и письма не шлёт", async () => {
        mockSession.mockResolvedValue(SESSION_SPECIALIST.user);
        const res = await POST(makeReq("/x", "POST", {level: "L4"}), params);
        expect(res.status).toBe(403);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe("админ переводит шаг онбординга → письмо специалисту", () => {
    let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    const params = {params: Promise.resolve({id: "spec-1"})};

    beforeAll(async () => {
        ({PATCH} = await import("@/app/api/admin/specialists/[id]/onboarding/route"));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.mockResolvedValue(SESSION_ADMIN.user);
        db.onboardingStep.findFirst.mockResolvedValue({id: "step-1", type: "REGULATIONS", status: "IN_PROGRESS"});
        db.onboardingStep.findMany.mockResolvedValue([]);
    });

    /** Шаг закрывается админом: from — текущий статус, to — статус после перевода. */
    function arrangeAdvance(from: string, to: string) {
        db.specialistProfile.findUnique.mockResolvedValue({...PROFILE, onboardingStatus: from});
        db.specialistProfile.update.mockResolvedValue({
            ...PROFILE,
            onboardingStatus: to,
            userId: "spec-1",
            user: {email: "spec@test.com"},
        });
    }

    test.each([
        ["PENDING", "TEST_INVITED", "Приглашение на квалификационное тестирование NEXUS"],
        ["TEST_INVITED", "INTERVIEW_INVITED", "Приглашение на интервью NEXUS"],
        ["INTERVIEW_INVITED", "REGULATIONS", "Изучение регламентов платформы NEXUS"],
        ["REGULATIONS", "CONTRACT", "Подписание договора NEXUS"],
    ])("перевод %s → %s уходит письмом «%s»", async (from, to, subject) => {
        arrangeAdvance(from, to);

        const res = await PATCH(makeReq("/x", "PATCH", {action: "advance"}), params);
        expect(res.status).toBe(200);

        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(lastMail().to).toBe("spec@test.com");
        expect(lastMail().subject).toBe(subject);
    });

    test("отказ тоже уходит на почту с объяснением причины", async () => {
        arrangeAdvance("TEST_INVITED", "REJECTED");

        const res = await PATCH(makeReq("/x", "PATCH", {action: "reject_no_experience"}), params);
        expect(res.status).toBe(200);
        expect(lastMail().to).toBe("spec@test.com");
        expect(lastMail().subject).toBe("Результат рассмотрения Вашей кандидатуры");
        expect(lastMail().html).toContain("8 лет");
    });
});
