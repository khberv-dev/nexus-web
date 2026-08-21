import {
    buildShuffledOptionOrder,
    buildShuffledQuestionOrder,
    getLevelBank,
    getPublicLevelQuestionsOrdered,
    toShownOptionIndex,
} from "../../src/lib/onboarding/levels/banks";
import {isQuizAnswerHintEnabled, quizOptionLetter} from "../../src/lib/dev-quiz-answers";

describe("dev quiz answer hint", () => {
    describe("gate", () => {
        const original = {node: process.env.NODE_ENV, flag: process.env.DEV_QUIZ_ANSWERS};

        afterEach(() => {
            Object.defineProperty(process.env, "NODE_ENV", {value: original.node, configurable: true});
            if (original.flag === undefined) delete process.env.DEV_QUIZ_ANSWERS;
            else process.env.DEV_QUIZ_ANSWERS = original.flag;
        });

        test("on by default outside production", () => {
            delete process.env.DEV_QUIZ_ANSWERS;
            expect(isQuizAnswerHintEnabled()).toBe(true);
        });

        test("explicit opt-out disables it", () => {
            process.env.DEV_QUIZ_ANSWERS = "false";
            expect(isQuizAnswerHintEnabled()).toBe(false);
        });

        test("never enabled in production, even with the flag on", () => {
            Object.defineProperty(process.env, "NODE_ENV", {value: "production", configurable: true});
            process.env.DEV_QUIZ_ANSWERS = "true";
            expect(isQuizAnswerHintEnabled()).toBe(false);
        });
    });

    describe("qualification test translation", () => {
        // Роут собирает подсказку теми же функциями: порядок вариантов попытки + toShownOptionIndex.
        test("hint index points at the bank's correct option in the shown order", () => {
            const level = "L1" as const;
            const questionOrder = buildShuffledQuestionOrder(level);
            const optionOrder = buildShuffledOptionOrder(level);
            const shown = getPublicLevelQuestionsOrdered(level, questionOrder, optionOrder);
            const bank = getLevelBank(level);

            expect(shown).toHaveLength(bank.questions.length);
            shown.forEach(q => {
                const source = bank.questions.find(x => x.id === q.id)!;
                const hint = toShownOptionIndex(optionOrder[String(q.id)], source.correct);
                expect(q.options[hint]).toBe(source.options[source.correct]);
            });
        });

        test("option letters match the quiz UI", () => {
            expect([0, 1, 2, 3].map(quizOptionLetter)).toEqual(["А", "Б", "В", "Г"]);
        });
    });
});
