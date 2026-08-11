import type {OnboardingStatus} from "@/components/app/SpecialistCard"
import {getLevelBank} from "@/lib/onboarding/levels/banks"
import type {QuizLevelCode} from "@/lib/onboarding/levels/types"
import {getQuizMicroTick, parseQuizProgress, parseStoredTestComment} from "@/lib/onboarding/nexus-quiz"
import type {RawSpecialist, TestModalData} from "../../types"
import {ONBOARDING_STEPS_UI} from "./constants"

type OnboardingStepRow = NonNullable<RawSpecialist["specialistProfile"]>["steps"][number]

export function SpecialistProfileOnboardingSection({
                                                       formData: fd,
                                                       status,
                                                       steps,
                                                       passedSet,
                                                       doneCount,
                                                       testStepRecord,
                                                       showTestAnswersBeforeAdvance,
                                                       quizResetting,
                                                       quizApproving,
                                                       acting,
                                                       handleQuizDraftReset,
                                                       handleQuizLevelApprove,
                                                       onRefresh,
                                                       setTestModal,
                                                   }: {
    formData: Record<string, string> | null | undefined
    status: OnboardingStatus
    steps: OnboardingStepRow[]
    passedSet: Set<string>
    doneCount: number
    testStepRecord: OnboardingStepRow | undefined
    showTestAnswersBeforeAdvance: boolean
    quizResetting: boolean
    quizApproving: boolean
    acting: string | null
    handleQuizDraftReset: () => void
    handleQuizLevelApprove: () => void
    onRefresh?: () => Promise<void>
    setTestModal: (data: TestModalData | null) => void
}) {
    const testProgressLive = testStepRecord?.comment ? parseQuizProgress(testStepRecord.comment) : null
    const levelQuestionsForTicks = (() => {
        const code = testProgressLive?.currentLevel
        if (code && ["L1", "L2", "L3", "L4"].includes(code)) {
            return getLevelBank(code as QuizLevelCode).questions
        }
        return undefined
    })()
    const pendingApprovalLevel = (() => {
        if (!testStepRecord?.comment) return null
        try {
            const j = JSON.parse(testStepRecord.comment) as { version?: number; pendingApprovalLevel?: string | null }
            if (j.version === 5 && (typeof j.pendingApprovalLevel === "string" || j.pendingApprovalLevel === null)) {
                return j.pendingApprovalLevel ?? null
            }
        } catch {
            /* ignore */
        }
        return null
    })()
    const attemptsCount = (() => {
        if (!testStepRecord?.comment) return 0
        try {
            const parsed = JSON.parse(testStepRecord.comment) as { version?: number; attempts?: unknown[] }
            if ((parsed.version === 4 || parsed.version === 5) && Array.isArray(parsed.attempts)) return parsed.attempts.length
        } catch {
            /* ignore */
        }
        return 0
    })()

    return (
        <>
            <div className="sp-onboarding-bar">
                <div className="sp-onboarding-bar__track">
                    <div className="sp-onboarding-bar__fill"
                         style={{width: `${(doneCount / ONBOARDING_STEPS_UI.length) * 100}%`}}/>
                </div>
                <div className="sp-onboarding-steps">
                    {ONBOARDING_STEPS_UI.map((step, i) => {
                        const done = step.key === "FORM"
                            ? (fd && Object.values(fd).some(Boolean)) || status !== "PENDING"
                            : passedSet.has(step.key) || status === "ACTIVE"
                        const isTest = step.key === "TEST"
                        const testStep = isTest ? steps.find((s) => s.type === "TEST") : null
                        const testPassed = isTest && (passedSet.has("TEST") || status === "ACTIVE")
                        const testInProgress = isTest && testStep?.status === "IN_PROGRESS"
                        const testReviewable =
                            isTest &&
                            !!testStep?.comment &&
                            (testPassed || testStep.status === "FAILED" || testStep.status === "IN_PROGRESS")
                        return (
                            <button
                                type="button"
                                key={step.key}
                                className={`sp-onboarding-step${done ? " sp-onboarding-step--done" : ""}${testInProgress ? " sp-onboarding-step--active" : ""}${testReviewable ? " sp-onboarding-step--clickable" : ""}`}
                                onClick={() => {
                                    if (!testReviewable || !testStep?.comment) return
                                    const {answers, meta} = parseStoredTestComment(testStep.comment)
                                    setTestModal({answers, comment: testStep.comment, meta})
                                }}
                            >
                                <div className="sp-onboarding-step__dot">{done ? <i className="bx bx-check"/> :
                                    <span>{i + 1}</span>}</div>
                                <span className="sp-onboarding-step__label">
                  {step.label}
                                    {testReviewable &&
                                        <i className="bx bx-show" style={{marginLeft: 3, fontSize: "0.7rem"}}/>}
                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {(testProgressLive || pendingApprovalLevel) && (
                <div className="sp-quiz-micro-wrap">
                    <div className="sp-quiz-micro-label">
                        {testProgressLive ? (
                            <>
                                Квалификационный тест:
                                отвечено {testProgressLive.answeredCount} из {testProgressLive.total}
                                {" · "}
                                верных по текущим ответам: {testProgressLive.liveCorrect}
                                {attemptsCount > 0 && (
                                    <>
                                        {" · "}
                                        попыток уровня: {attemptsCount}
                                    </>
                                )}
                            </>
                        ) : (
                            <>Квалификационный тест: уровень пройден и ожидает подтверждения администратора</>
                        )}
                    </div>
                    {testProgressLive && (
                        <div className="sp-quiz-micro-ticks"
                             aria-label="Прогресс по вопросам: зеленый — верно, красный — неверно">
                            {Array.from({length: testProgressLive.total}, (_, i) => {
                                const {
                                    state,
                                    tooltip
                                } = getQuizMicroTick(i, testProgressLive.answers, levelQuestionsForTicks)
                                const tickClass = ["sp-quiz-micro-tick"]
                                if (state === "correct") tickClass.push("sp-quiz-micro-tick--answered", "sp-quiz-micro-tick--correct")
                                if (state === "wrong") tickClass.push("sp-quiz-micro-tick--answered", "sp-quiz-micro-tick--wrong")
                                return <span key={i} className={tickClass.join(" ")} title={tooltip}/>
                            })}
                        </div>
                    )}
                    {onRefresh && (
                        <div style={{marginTop: 12}}>
                            <button
                                type="button"
                                className="sp-btn sp-btn-ghost"
                                disabled={quizResetting || acting !== null}
                                onClick={handleQuizDraftReset}
                            >
                                {quizResetting ? "Сброс…" : "Сбросить черновик теста"}
                            </button>
                            {pendingApprovalLevel && (
                                <button
                                    type="button"
                                    className="sp-btn sp-btn-primary"
                                    style={{marginLeft: 8}}
                                    disabled={quizApproving || acting !== null}
                                    onClick={handleQuizLevelApprove}
                                >
                                    {quizApproving ? "Подтверждение…" : `Подтвердить уровень ${pendingApprovalLevel}`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showTestAnswersBeforeAdvance && testStepRecord?.comment && (
                <div style={{marginBottom: 18}}>
                    <p style={{fontSize: "0.78rem", color: "var(--adm-muted)", margin: "0 0 8px", lineHeight: 1.45}}>
                        {testStepRecord.status === "IN_PROGRESS"
                            ? "Специалист проходит тест. Ниже виден сохраненный прогресс; в модалке — ответы на уже закрытые вопросы."
                            : "Специалист уже отправил тест. Откройте ответы по вопросам перед тем, как нажать «Тест пройден»."}
                    </p>
                    <button
                        type="button"
                        className="sp-btn sp-btn-ghost"
                        onClick={() => {
                            const {answers, meta} = parseStoredTestComment(testStepRecord.comment)
                            setTestModal({answers, comment: testStepRecord.comment, meta})
                        }}
                    >
                        <i className="bx bx-show" style={{marginRight: 6}}/>
                        {testStepRecord.status === "IN_PROGRESS" ? "Ответы (текущий прогресс)" : "Ответы квалификационного теста"}
                    </button>
                </div>
            )}
        </>
    )
}
