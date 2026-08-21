import {QUIZ_QUESTIONS} from "../../src/lib/onboarding/regulations-questions";
import {
    buildRegulationsQuizState,
    buildRegulationsSessionPayload,
    getPublicRegulationsQuestions,
    gradeRegulationsQuiz,
    nextRegulationsQuestionIndex,
    parseRegulationsQuizState,
    REGULATIONS_PASS_PERCENT,
    REGULATIONS_QUESTION_TIME_LIMIT_SEC,
    REGULATIONS_TOTAL,
    toOriginalOption,
    toShownOption,
} from "../../src/lib/onboarding/regulations-quiz";

describe("regulations quiz session", () => {
    describe("shuffling", () => {
        test("question order is a permutation of the whole bank", () => {
            const state = buildRegulationsQuizState();
            expect(state.questionOrder).toHaveLength(REGULATIONS_TOTAL);
            expect(new Set(state.questionOrder).size).toBe(REGULATIONS_TOTAL);
        });

        test("every question gets a permutation of its four options", () => {
            const state = buildRegulationsQuizState();
            expect(Object.keys(state.optionOrder)).toHaveLength(REGULATIONS_TOTAL);
            for (const order of Object.values(state.optionOrder)) {
                expect([...order].sort()).toEqual([0, 1, 2, 3]);
            }
        });

        test("consecutive attempts differ (question or option order)", () => {
            const a = buildRegulationsQuizState();
            const b = buildRegulationsQuizState();
            const sameQuestions = JSON.stringify(a.questionOrder) === JSON.stringify(b.questionOrder);
            const sameOptions = JSON.stringify(a.optionOrder) === JSON.stringify(b.optionOrder);
            expect(sameQuestions && sameOptions).toBe(false);
        });

        test("public questions follow the shuffled order and never leak answers", () => {
            const state = buildRegulationsQuizState();
            const questions = getPublicRegulationsQuestions(state);
            expect(questions.map((q) => q.index)).toEqual(state.questionOrder);
            questions.forEach((q) => {
                const order = state.optionOrder[String(q.index)];
                expect(q.options).toEqual(order.map((o) => QUIZ_QUESTIONS[q.index].options[o]));
                expect(q).not.toHaveProperty("correct");
                expect(q).not.toHaveProperty("explain");
            });
        });

        test("shown option index maps back to the bank index", () => {
            const state = buildRegulationsQuizState();
            for (const index of state.questionOrder) {
                const order = state.optionOrder[String(index)];
                const correct = QUIZ_QUESTIONS[index].correct;
                expect(toOriginalOption(order, toShownOption(order, correct))).toBe(correct);
            }
        });
    });

    describe("timer", () => {
        test("first question gets a 30 second deadline", () => {
            const now = new Date("2026-08-17T10:00:00.000Z");
            const state = buildRegulationsQuizState(now);
            expect(state.questionDeadlineAt).toBe(
                new Date(now.getTime() + REGULATIONS_QUESTION_TIME_LIMIT_SEC * 1000).toISOString(),
            );
            expect(REGULATIONS_QUESTION_TIME_LIMIT_SEC).toBe(30);
        });

        test("session payload carries the deadline and limit to the client", () => {
            const state = buildRegulationsQuizState();
            const payload = buildRegulationsSessionPayload(state);
            expect(payload.timeLimitSec).toBe(REGULATIONS_QUESTION_TIME_LIMIT_SEC);
            expect(payload.questionDeadlineAt).toBe(state.questionDeadlineAt);
            expect(payload.currentPosition).toBe(0);
            expect(payload.answeredCount).toBe(0);
        });
    });

    describe("grading", () => {
        test("all correct passes, all timed out fails", () => {
            const allRight: Record<string, number> = {};
            const allTimedOut: Record<string, number> = {};
            QUIZ_QUESTIONS.forEach((q, i) => {
                allRight[String(i)] = q.correct;
                allTimedOut[String(i)] = -1;
            });

            const right = gradeRegulationsQuiz(allRight);
            expect(right.score).toBe(REGULATIONS_TOTAL);
            expect(right.pct).toBe(100);
            expect(right.passed).toBe(true);

            const timedOut = gradeRegulationsQuiz(allTimedOut);
            expect(timedOut.score).toBe(0);
            expect(timedOut.passed).toBe(false);
        });

        test("section totals cover every question", () => {
            const grade = gradeRegulationsQuiz({});
            const totals = Object.values(grade.sectionScores).reduce((sum, v) => sum + v.total, 0);
            expect(totals).toBe(REGULATIONS_TOTAL);
        });

        test("pass threshold is the documented 80%", () => {
            const answers: Record<string, number> = {};
            const needed = Math.ceil((REGULATIONS_PASS_PERCENT / 100) * REGULATIONS_TOTAL);
            QUIZ_QUESTIONS.forEach((q, i) => {
                answers[String(i)] = i < needed ? q.correct : -1;
            });
            expect(gradeRegulationsQuiz(answers).passed).toBe(true);

            delete answers[String(needed - 1)];
            answers[String(needed - 1)] = -1;
            expect(gradeRegulationsQuiz(answers).passed).toBe(false);
        });
    });

    describe("state parsing", () => {
        test("finished attempt is not an active session", () => {
            const finished = JSON.stringify({score: 30, passed: true, answers: {"0": 1}, finishedAt: "2026-08-17T10:00:00.000Z"});
            expect(parseRegulationsQuizState(finished)).toBeNull();
        });

        test("pointer is repaired to the first unanswered question", () => {
            const state = buildRegulationsQuizState();
            const first = state.questionOrder[0];
            const stale = JSON.stringify({...state, answers: {[String(first)]: 0}, currentQuestionIndex: first});
            const parsed = parseRegulationsQuizState(stale)!;
            expect(parsed.currentQuestionIndex).toBe(state.questionOrder[1]);
            expect(parsed.currentQuestionIndex).toBe(nextRegulationsQuestionIndex(parsed));
        });

        test("legacy (pre-shuffle) progress is upgraded to an ordered session", () => {
            const legacy = JSON.stringify({answers: {"0": 2, "1": 1}, score: 1, sectionScores: {}});
            const parsed = parseRegulationsQuizState(legacy)!;
            expect(parsed.version).toBe(2);
            expect(parsed.questionOrder).toEqual(QUIZ_QUESTIONS.map((_, i) => i));
            expect(parsed.currentQuestionIndex).toBe(2);
        });

        test("out-of-range answers are dropped", () => {
            const parsed = parseRegulationsQuizState(JSON.stringify({answers: {"0": 9, "999": 1, "1": 2}}))!;
            expect(Object.keys(parsed.answers)).toEqual(["1"]);
        });

        test("garbage comment yields no session", () => {
            expect(parseRegulationsQuizState("not json")).toBeNull();
            expect(parseRegulationsQuizState(null)).toBeNull();
            expect(parseRegulationsQuizState(JSON.stringify({answers: {}}))).toBeNull();
        });
    });
});

describe("dev answer hint", () => {
    test("devAnswers points at the correct option in the shuffled order", () => {
        const state = buildRegulationsQuizState();
        const payload = buildRegulationsSessionPayload(state) as ReturnType<typeof buildRegulationsSessionPayload> & {
            devAnswers?: Record<string, number>
        };

        // В dev-окружении jest подсказка включена — иначе проверять нечего.
        expect(payload.devAnswers).toBeDefined();

        payload.questions.forEach(q => {
            const shown = payload.devAnswers![String(q.index)];
            // Подсказка указывает на тот же текст, что помечен верным в банке вопросов.
            expect(q.options[shown]).toBe(QUIZ_QUESTIONS[q.index].options[QUIZ_QUESTIONS[q.index].correct]);
        });
    });

    test("hint is withheld when the flag is off", () => {
        const original = process.env.DEV_QUIZ_ANSWERS;
        process.env.DEV_QUIZ_ANSWERS = "false";
        try {
            const payload = buildRegulationsSessionPayload(buildRegulationsQuizState()) as {
                devAnswers?: Record<string, number>
            };
            expect(payload.devAnswers).toBeUndefined();
        } finally {
            if (original === undefined) delete process.env.DEV_QUIZ_ANSWERS;
            else process.env.DEV_QUIZ_ANSWERS = original;
        }
    });
});
