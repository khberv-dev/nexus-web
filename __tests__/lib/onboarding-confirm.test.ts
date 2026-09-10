/**
 * Содержимое красной модалки подтверждения для кнопок онбординга в админке.
 *
 * Смысл проверок: диалог должен прямо говорить, что действие ручное и не для
 * реального кандидата, и называть конкретные последствия (принудительно закрытый
 * шаг, письмо специалисту) — иначе админ перестаёт его читать.
 */

import {
    ADVANCE_TITLE,
    buildOnboardingActionConfirm,
    REJECT_TITLE,
    type SpecialistOnboardingAdminAction,
} from "@/app/admin/specialists/onboarding-confirm";

const PASSED_TEST = [{type: "TEST", status: "PASSED"}];
const PASSED_REGULATIONS = [{type: "REGULATIONS", status: "PASSED"}];

describe("заголовок предупреждает, что действие ручное", () => {
    test("перевод шага", () => {
        const {title, subtitle} = buildOnboardingActionConfirm({action: "advance", status: "PENDING"});
        expect(title).toBe(ADVANCE_TITLE);
        expect(title).toContain("Ручной пропуск шага");
        expect(title).toContain("не для реальных пользователей");
        expect(subtitle).toContain("без прохождения");
    });

    test("отказ", () => {
        const {title, subtitle} = buildOnboardingActionConfirm({action: "reject", status: "PENDING"});
        expect(title).toBe(REJECT_TITLE);
        expect(title).toContain("не для реальных пользователей");
        expect(subtitle).toContain("отказ");
    });
});

describe("перевод на следующий шаг", () => {
    test.each([
        ["PENDING", "квалификационный тест"],
        ["TEST_INVITED", "интервью"],
        ["INTERVIEW_INVITED", "регламент"],
        ["REGULATIONS", "договор"],
        ["CONTRACT", "договор"],
    ])("на статусе %s вопрос называет следующий шаг", (status, expected) => {
        const {question} = buildOnboardingActionConfirm({
            action: "advance",
            status: status as never,
            steps: [...PASSED_TEST, ...PASSED_REGULATIONS],
            contractStatus: "SIGNED_BY_ADMIN",
        });
        expect(question.toLowerCase()).toContain(expected);
    });

    test("кнопка подтверждения названа действием, а не «ОК»", () => {
        const {confirmLabel} = buildOnboardingActionConfirm({action: "advance", status: "PENDING"});
        expect(confirmLabel).toBe("Да, пропустить шаг");
    });

    test("непройденный тест попадает в список принудительно закрытых шагов", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "advance",
            status: "TEST_INVITED",
            steps: [{type: "TEST", status: "IN_PROGRESS"}],
        });
        expect(forcedSteps).toEqual(["Квалификационный тест"]);
    });

    test("пройденный тест в список не попадает", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "advance",
            status: "TEST_INVITED",
            steps: PASSED_TEST,
        });
        expect(forcedSteps).toEqual([]);
    });

    test("интервью не считается непройденным шагом — его подтверждает сам админ", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "advance",
            status: "INTERVIEW_INVITED",
            steps: [],
        });
        expect(forcedSteps).toEqual([]);
    });

    test("договор без подписи админа предупреждает о подписи", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "advance",
            status: "CONTRACT",
            steps: [],
            contractStatus: "AWAITING_SIGNATURE",
        });
        expect(forcedSteps).toEqual(["Подпись договора"]);
    });

    test("договор подписан админом — предупреждать не о чем", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "advance",
            status: "CONTRACT",
            steps: [],
            contractStatus: "SIGNED_BY_ADMIN",
        });
        expect(forcedSteps).toEqual([]);
    });

    test("карточка ещё не загрузилась — вопрос всё равно задаётся", () => {
        const {title, question} = buildOnboardingActionConfirm({action: "advance", status: null});
        expect(title).toBe(ADVANCE_TITLE);
        expect(question).toContain("следующий шаг онбординга?");
    });
});

describe("отказы", () => {
    test.each<[Exclude<SpecialistOnboardingAdminAction, "advance">, string]>([
        ["reject", "Онбординг будет остановлен"],
        ["reject_no_education", "профильного образования"],
        ["reject_no_experience", "8 лет"],
    ])("%s объясняет причину", (action, expected) => {
        const {question, confirmLabel} = buildOnboardingActionConfirm({action, status: "PENDING", steps: []});
        expect(question).toContain(expected);
        expect(confirmLabel).toBe("Да, отклонить");
    });

    test("отказ не тянет предупреждение о непройденных шагах", () => {
        const {forcedSteps} = buildOnboardingActionConfirm({
            action: "reject",
            status: "TEST_INVITED",
            steps: [{type: "TEST", status: "IN_PROGRESS"}],
        });
        expect(forcedSteps).toEqual([]);
    });
});
