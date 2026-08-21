"use client"

import {type CSSProperties, useCallback, useEffect, useMemo, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"
import {type DecodedQuizQuestion, decodeQuizQuestionWire, type NexusQuizQuestionWire,} from "@/lib/onboarding/quiz-wire"
import {logQuizAnswerHint} from "@/lib/dev-quiz-hint"
import type {QuizLevelCode, QuizLevelMeta} from "@/lib/onboarding/levels/types"

const LETTERS = ["А", "Б", "В", "Г"]
const QUESTION_TIME_LIMIT_SEC = 30
const RETRY_COOLDOWN_SEC = 60

const protectQuizSurface: CSSProperties = {
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none",
}

type QuizResume = {
    answers: Record<string, number>
    answeredCount: number
    liveCorrect: number
    total: number
    lastQuestionId: number
    currentQuestionId: number
    questionDeadlineAt: string | null
}

type QuizPayload = {
    level: QuizLevelCode
    levelTitle: string
    levels: QuizLevelMeta[]
    availableLevels: QuizLevelCode[]
    attemptsByLevel: Record<string, number>
    passPercent: number
    total: number
    questions: DecodedQuizQuestion[]
    /** Wire (base64) для data-* в DOM; текст вопроса в сети не дублируем открытым видом. */
    questionsWire: NexusQuizQuestionWire[]
    resume: QuizResume | null
    /** Только dev: questionId → индекс правильного варианта (в показанном порядке). */
    devAnswers?: Record<string, number>
}

export default function OnboardingTestPage() {
    const router = useRouter()
    const [gate, setGate] = useState<"loading" | "ok" | "error">("loading")
    const [gateMessage, setGateMessage] = useState("")
    const [gateCode, setGateCode] = useState<string | null>(null)
    const [payload, setPayload] = useState<QuizPayload | null>(null)
    const [selectedLevel, setSelectedLevel] = useState<QuizLevelCode>("L1")

    const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro")
    const [qIndex, setQIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<number, number>>({})
    const [answerResults, setAnswerResults] = useState<Record<number, boolean>>({}) // questionId → isCorrect
    const [liveScore, setLiveScore] = useState(0)
    const [revealed, setRevealed] = useState(false)
    const [revealFb, setRevealFb] = useState<{ isCorrect: boolean; correctIndex: number; explain: string } | null>(null)
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT_SEC)

    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)
    const [resultFail, setResultFail] = useState<{
        correctCount: number;
        total: number;
        percent: number;
        passPercent: number;
        attemptsLeft: number
    } | null>(
        null
    )
    const [resultOk, setResultOk] = useState<{ percent: number; transitionText?: string } | null>(null)
    const [resultExhausted, setResultExhausted] = useState<{
        level: QuizLevelCode;
        onboardingStatus: string;
        comment?: string
    } | null>(null)
    const [cooldownLeft, setCooldownLeft] = useState<number>(0)
    const [lastAttemptTimestamp, setLastAttemptTimestamp] = useState<number | null>(null)
    const revealInFlightRef = useRef(false)
    const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stopQuestionTimer = useCallback(() => {
        if (questionTimerRef.current) {
            clearInterval(questionTimerRef.current)
            questionTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const res = await fetch(`/api/onboarding/quiz?level=${selectedLevel}`)
            const data = await res.json().catch(() => ({}))
            if (cancelled) return
            if (!res.ok) {
                setGate("error")
                setGateMessage(typeof data.error === "string" ? data.error : "Не удалось загрузить тест")
                setGateCode(typeof data.code === "string" ? data.code : null)
                return
            }
            const wire = data.questions as NexusQuizQuestionWire[]
            if (!Array.isArray(wire) || wire.length === 0) {
                setGate("error")
                setGateMessage("Некорректный ответ сервера")
                return
            }
            const questions = wire.map(decodeQuizQuestionWire)
            setPayload({
                level: (data.level as QuizLevelCode) ?? selectedLevel,
                levelTitle: String(data.levelTitle ?? selectedLevel),
                levels: Array.isArray(data.levels) ? (data.levels as QuizLevelMeta[]) : [],
                availableLevels: Array.isArray(data.availableLevels) ? (data.availableLevels as QuizLevelCode[]) : [selectedLevel],
                attemptsByLevel:
                    data.attemptsByLevel && typeof data.attemptsByLevel === "object"
                        ? (data.attemptsByLevel as Record<string, number>)
                        : {},
                passPercent: Number(data.passPercent),
                total: Number(data.total) || questions.length,
                questions,
                questionsWire: wire,
                resume: data.resume ?? null,
                devAnswers: (data.devAnswers as Record<string, number> | undefined) ?? undefined,
            })
            setGate("ok")
        })()
        return () => {
            cancelled = true
        }
    }, [selectedLevel])

    const resetRun = useCallback(() => {
        const now = Date.now()
        if (lastAttemptTimestamp && now - lastAttemptTimestamp < RETRY_COOLDOWN_SEC * 1000) {
            return
        }
        setPhase("intro")
        setQIndex(0)
        setAnswers({})
        setAnswerResults({})
        setLiveScore(0)
        setRevealed(false)
        setRevealFb(null)
        setTimeLeft(QUESTION_TIME_LIMIT_SEC)
        setServerError(null)
        setResultFail(null)
        setResultOk(null)
        setResultExhausted(null)
    }, [lastAttemptTimestamp])

    const applyResume = useCallback((p: QuizPayload, opts?: { freshTimer?: boolean }) => {
        const r = p.resume
        if (!r) {
            setQIndex(0)
            setAnswers({})
            setAnswerResults({})
            setLiveScore(0)
            setRevealed(false)
            setRevealFb(null)
            setServerError(null)
            setTimeLeft(QUESTION_TIME_LIMIT_SEC)
            setPhase("quiz")
            return
        }
        if (r.answeredCount > 0) {
            const ans: Record<number, number> = {}
            for (const [k, v] of Object.entries(r.answers)) ans[Number(k)] = v
            setAnswers(ans)
            setLiveScore(r.liveCorrect)
        } else {
            setAnswers({})
            setAnswerResults({})
            setLiveScore(0)
        }
        const idxByCurrent = p.questions.findIndex((q) => q.id === r.currentQuestionId)
        const idxByAnswers = p.questions.findIndex((q) => r.answers[String(q.id)] === undefined)
        const idx = idxByCurrent >= 0 ? idxByCurrent : idxByAnswers
        const resolvedIdx = idx === -1 ? Math.max(0, p.questions.length - 1) : idx
        setQIndex(resolvedIdx)
        setRevealed(false)
        setRevealFb(null)
        setServerError(null)
        const resumeQuestionId = r.currentQuestionId
        const resumeDeadline = r.questionDeadlineAt ? new Date(r.questionDeadlineAt).getTime() : NaN
        const hasResumeDeadline = Number.isFinite(resumeDeadline)
        const hasQuestionInResume = p.questions[resolvedIdx]?.id === resumeQuestionId
        const resumeTimeLeft =
            opts?.freshTimer || !hasResumeDeadline || !hasQuestionInResume
                ? QUESTION_TIME_LIMIT_SEC
                : Math.max(0, Math.floor((resumeDeadline - Date.now()) / 1000))
        setTimeLeft(resumeTimeLeft > 0 ? resumeTimeLeft : QUESTION_TIME_LIMIT_SEC)
        setPhase("quiz")
    }, [])

    const questions = useMemo(() => payload?.questions ?? [], [payload])
    const questionsWire = useMemo(() => payload?.questionsWire ?? [], [payload])
    const total = questions.length
    const passPercent = payload?.passPercent ?? 70
    const current = questions[qIndex]
    const currentWire = questionsWire[qIndex]
    const isCurrentTimedOut = current ? answers[current.id] === -1 : false
    const currentLevelIdx = payload ? payload.levels.findIndex((lvl) => lvl.code === payload.level) : -1
    const nextLevelMeta = currentLevelIdx >= 0 && payload ? payload.levels[currentLevelIdx + 1] : undefined

    const submitReveal = useCallback(async (optionIdx: number | null) => {
        if (!current || revealed || submitting || revealInFlightRef.current) return false
        revealInFlightRef.current = true
        stopQuestionTimer()
        const reqPayload =
            optionIdx === null
                ? {level: payload?.level ?? selectedLevel, questionId: current.id, timedOut: true}
                : {level: payload?.level ?? selectedLevel, questionId: current.id, selectedIndex: optionIdx}
        try {
            const res = await fetch("/api/onboarding/quiz/reveal", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(reqPayload),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (data.code === "QUESTION_ORDER") {
                    setServerError("Сессия теста рассинхронизирована. Обновите страницу и нажмите «Продолжить тест».")
                } else {
                    setServerError(typeof data.error === "string" ? data.error : "Ошибка проверки ответа")
                }
                return false
            }
            const savedIndex =
                typeof data.savedIndex === "number" && Number.isInteger(data.savedIndex)
                    ? data.savedIndex
                    : optionIdx === null
                        ? -1
                        : optionIdx
            setAnswers((a) => ({...a, [current.id]: savedIndex}))
            setAnswerResults((r) => ({...r, [current.id]: Boolean(data.isCorrect)}))
            if (data.progress && typeof data.progress.liveCorrect === "number") {
                setLiveScore(Number(data.progress.liveCorrect))
            } else if (data.isCorrect) {
                setLiveScore((s) => s + 1)
            }
            setRevealFb({
                isCorrect: Boolean(data.isCorrect),
                correctIndex: Number(data.correctIndex),
                explain: String(data.explain ?? ""),
            })
            setRevealed(true)
            return true
        } finally {
            revealInFlightRef.current = false
        }
    }, [current, revealed, submitting, payload, selectedLevel, stopQuestionTimer])

    const handleOptionPick = async (optionIdx: number) => {
        stopQuestionTimer()
        await submitReveal(optionIdx)
    }

    // Dev: правильный вариант текущего вопроса — в консоль браузера.
    useEffect(() => {
        if (phase !== "quiz" || !current) return
        logQuizAnswerHint({
            quiz: `Квалификационный тест ${payload?.level ?? ""}`.trim(),
            position: qIndex + 1,
            total,
            question: current.text,
            options: current.options,
            correctIndex: payload?.devAnswers?.[String(current.id)],
        })
    }, [phase, current, qIndex, total, payload])

    useEffect(() => {
        if (phase !== "quiz" || !current || revealed || submitting) return
        stopQuestionTimer()
        const id = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(id)
                    questionTimerRef.current = null
                    void submitReveal(null)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        questionTimerRef.current = id
        return () => {
            clearInterval(id)
            if (questionTimerRef.current === id) questionTimerRef.current = null
        }
    }, [phase, current, revealed, submitting, submitReveal, stopQuestionTimer])

    // Cooldown timer
    useEffect(() => {
        if (cooldownLeft <= 0) return
        const id = setInterval(() => {
            setCooldownLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(id)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(id)
    }, [cooldownLeft])

    const goNext = useCallback(() => {
        if (!revealed || qIndex >= total - 1) return
        stopQuestionTimer()
        setQIndex((i) => i + 1)
        setTimeLeft(QUESTION_TIME_LIMIT_SEC)
        setRevealed(false)
        setRevealFb(null)
    }, [revealed, qIndex, total, stopQuestionTimer])

    const finishQuiz = useCallback(async () => {
        if (!revealed || qIndex < total - 1) return
        setSubmitting(true)
        setServerError(null)
        const bodyAnswers: Record<string, number> = {}
        for (const q of questions) {
            bodyAnswers[String(q.id)] = answers[q.id] ?? -1
        }
        const res = await fetch("/api/onboarding/step", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({type: "TEST", level: payload?.level ?? selectedLevel, answers: bodyAnswers}),
        })
        const data = await res.json().catch(() => ({}))
        setSubmitting(false)
        if (res.status === 422 && data) {
            const now = Date.now()
            setLastAttemptTimestamp(now)
            setCooldownLeft(RETRY_COOLDOWN_SEC)

            if (data.exhausted && data.onboardingStatus) {
                setPhase("result")
                setResultExhausted({
                    level: (data.level as QuizLevelCode) ?? selectedLevel,
                    onboardingStatus: data.onboardingStatus,
                    comment: typeof data.comment === "string" ? data.comment : undefined
                })
                return
            }
            setPhase("result")
            setResultFail({
                correctCount: Number(data.correctCount),
                total: Number(data.total),
                percent: Number(data.percent),
                passPercent: Number(data.passPercent),
                attemptsLeft: Number(data.attemptsLeft ?? 0)
            })
            return
        }
        if (!res.ok) {
            setServerError(typeof data.error === "string" ? data.error : "Ошибка отправки")
            return
        }
        setPhase("result")
        setResultOk({
            percent: Number(data.percent),
            transitionText: typeof data.transitionText === "string" ? data.transitionText : undefined
        })
        setTimeout(() => router.push("/onboarding"), 1800)
    }, [revealed, qIndex, total, questions, answers, router, payload, selectedLevel])

    useEffect(() => {
        if (phase !== "quiz" || !revealed || !isCurrentTimedOut || submitting) return
        const timeoutId = setTimeout(() => {
            if (qIndex >= total - 1) {
                void finishQuiz()
            } else {
                goNext()
            }
        }, 1500)
        return () => clearTimeout(timeoutId)
    }, [phase, revealed, isCurrentTimedOut, submitting, qIndex, total, goNext, finishQuiz])

    const progressPct = total > 0 ? Math.round(((qIndex + 1) / total) * 100) : 0

    return (
        <OnboardingShell title="Квалификационный тест" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div className="mx-auto max-w-xl px-6 py-12">
                {gate === "loading" && (
                    <p style={{color: "rgba(255,255,255,0.45)", fontSize: "0.9rem"}}>Загрузка теста…</p>
                )}

                {gate === "error" && (
                    <AppCard>
                        <p style={{color: "#fca5a5", fontSize: "0.9rem", margin: 0}}>{gateMessage}</p>
                        <p style={{color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", marginTop: "0.75em"}}>
                            {gateCode === "AWAITING_ADMIN"
                                ? "Следующий этап теста откроется после подтверждения администратором. Обновите страницу позже или вернитесь в онбординг."
                                : "После приглашения администратора обновите страницу. В демо-режиме доступ открывается автоматически после отправки анкеты."}
                        </p>
                    </AppCard>
                )}

                {gate === "ok" && payload && phase === "intro" && (
                    <>
                        <div className="mb-8">
                            <h1
                                style={{
                                    color: "#f4f4f4",
                                    fontSize: "clamp(1.4rem,3vw,1.85rem)",
                                    fontWeight: 500,
                                    margin: 0,
                                    lineHeight: 1.2,
                                }}
                            >
                                Квалификационный тест
                            </h1>
                        </div>
                        <div className="mb-6" style={{display: "grid", gap: 8}}>
                            {payload.levels.map((lvl) => {
                                const selected = selectedLevel === lvl.code
                                const attempts = payload.attemptsByLevel[lvl.code] ?? 0
                                const available = payload.availableLevels.includes(lvl.code)
                                return (
                                    <button
                                        key={lvl.code}
                                        type="button"
                                        disabled={!available}
                                        onClick={() => setSelectedLevel(lvl.code)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            borderRadius: 10,
                                            border: selected ? "1px solid rgba(52,211,153,0.45)" : "1px solid rgba(255,255,255,0.15)",
                                            background: selected ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                                            color: available ? "#f4f4f4" : "rgba(255,255,255,0.4)",
                                            padding: "0.6em 0.85em",
                                            fontSize: "0.82rem",
                                            cursor: available ? "pointer" : "not-allowed",
                                        }}
                                    >
                                        {lvl.title} · {lvl.questionsCount} вопросов · попыток: {attempts}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="flex flex-wrap gap-8 mb-8"
                             style={{color: "rgba(255,255,255,0.5)", fontSize: "0.85rem"}}>
                            <div>
                                <div style={{
                                    color: "#f4f4f4",
                                    fontSize: "1.75rem",
                                    fontWeight: 600,
                                    lineHeight: 1
                                }}>{total}</div>
                                <div>вопросов</div>
                            </div>
                            <div>
                                <div style={{
                                    color: "#f4f4f4",
                                    fontSize: "1.75rem",
                                    fontWeight: 600,
                                    lineHeight: 1
                                }}>{passPercent}%
                                </div>
                                <div>проходной балл</div>
                            </div>
                            <div>
                                <div style={{
                                    color: "#f4f4f4",
                                    fontSize: "1.75rem",
                                    fontWeight: 600,
                                    lineHeight: 1
                                }}>{payload.level}</div>
                                <div>уровень</div>
                            </div>
                        </div>
                        {payload.resume && payload.resume.answeredCount > 0 ? (
                            <div className="flex flex-col gap-3">
                                <AppCard>
                                    <p style={{
                                        color: "rgba(255,255,255,0.75)",
                                        fontSize: "0.88rem",
                                        margin: 0,
                                        lineHeight: 1.5
                                    }}>
                                        Сохранен прогресс: отвечено <strong
                                        style={{color: "#f4f4f4"}}>{payload.resume.answeredCount}</strong> из{" "}
                                        {total}. Верных на данный момент (по сохраненным ответам):{" "}
                                        <strong style={{color: "#f4f4f4"}}>{payload.resume.liveCorrect}</strong>.
                                    </p>
                                    <p style={{
                                        color: "rgba(255,255,255,0.35)",
                                        fontSize: "0.78rem",
                                        margin: "0.75em 0 0",
                                        lineHeight: 1.45
                                    }}>
                                        Сбросить незавершенный тест и начать с чистого листа может только администратор.
                                    </p>
                                </AppCard>
                                <button
                                    type="button"
                                    onClick={() => applyResume(payload, {freshTimer: false})}
                                    style={{
                                        width: "100%",
                                        padding: "0.85em 1.5em",
                                        borderRadius: 999,
                                        border: "1px solid rgba(52,211,153,0.35)",
                                        background: "rgba(52,211,153,0.12)",
                                        color: "#6ee7b7",
                                        fontWeight: 600,
                                        fontSize: "0.9rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    Продолжить тест →
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (payload) applyResume(payload, {freshTimer: true})
                                }}
                                style={{
                                    width: "100%",
                                    padding: "0.85em 1.5em",
                                    borderRadius: 999,
                                    border: "1px solid rgba(255,255,255,0.25)",
                                    background: "rgba(255,255,255,0.1)",
                                    color: "#f4f4f4",
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    cursor: "pointer",
                                }}
                            >
                                Начать тест →
                            </button>
                        )}
                    </>
                )}

                {gate === "ok" && phase === "quiz" && current && (
                    <>
                        <div className="mb-4 flex justify-between items-center" style={{fontSize: "0.82rem"}}>
              <span style={{color: "rgba(255,255,255,0.45)"}}>
                Вопрос {qIndex + 1} из {total}
              </span>
                            <span style={{color: "rgba(255,255,255,0.65)", fontWeight: 600}}>
                {liveScore} верных из {Object.keys(answers).length} отвеченных
              </span>
                        </div>
                        <div
                            style={{
                                color: timeLeft <= 5 ? "#fca5a5" : "rgba(255,255,255,0.55)",
                                fontSize: "0.8rem",
                                marginBottom: "0.5rem",
                                fontWeight: timeLeft <= 5 ? 700 : 500,
                                letterSpacing: timeLeft <= 5 ? "0.03em" : "normal",
                            }}
                        >
                            {timeLeft <= 5 ? "Срочно: " : "Время на вопрос: "}
                            00:{String(timeLeft).padStart(2, "0")}
                        </div>
                        <div
                            style={{
                                height: 6,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.08)",
                                overflow: "hidden",
                                marginBottom: "0.65rem",
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${progressPct}%`,
                                    borderRadius: 999,
                                    background: "linear-gradient(90deg, rgba(52,211,153,0.9), rgba(45,212,191,0.85))",
                                    transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                                }}
                            />
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 3,
                                flexWrap: "wrap",
                                marginBottom: "1.1rem",
                                justifyContent: "space-between",
                            }}
                            aria-label="Прогресс: зеленый — верно, красный — неверно; наведите на сегмент — какой ответ выбран"
                        >
                            {Array.from({length: total}, (_, i) => {
                                const q = questions[i]
                                const qId = q?.id
                                const isAnswered = qId !== undefined && answers[qId] !== undefined
                                const hasResult = qId !== undefined && answerResults[qId] !== undefined
                                const isCorrect = hasResult && answerResults[qId] === true
                                const isWrong = hasResult && !isCorrect
                                const state: "pending" | "correct" | "wrong" | "answered" =
                                    !isAnswered ? "pending" : !hasResult ? "answered" : isCorrect ? "correct" : "wrong"
                                const tooltip = !isAnswered
                                    ? `Вопрос ${i + 1}: ещё не отвечен`
                                    : !hasResult
                                        ? `Вопрос ${i + 1}: отвечен`
                                        : isCorrect
                                            ? `Вопрос ${i + 1}: верно`
                                            : answers[qId!] === -1
                                                ? `Вопрос ${i + 1}: время вышло`
                                                : `Вопрос ${i + 1}: неверно`
                                const bg =
                                    state === "correct"
                                        ? "linear-gradient(90deg, rgba(52,211,153,0.9), rgba(74,222,128,0.85))"
                                        : state === "wrong"
                                            ? "linear-gradient(90deg, rgba(220,38,38,0.9), rgba(248,113,113,0.85))"
                                            : state === "answered"
                                                ? "rgba(255,255,255,0.35)"
                                                : "rgba(255,255,255,0.12)"
                                return (
                                    <div
                                        key={i}
                                        title={tooltip}
                                        style={{
                                            flex: "1 1 0",
                                            minWidth: 3,
                                            maxWidth: 14,
                                            height: 5,
                                            borderRadius: 2,
                                            background: bg,
                                            transition: "background 0.2s, transform 0.15s",
                                            cursor: state === "pending" ? "default" : "help",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (state !== "pending") e.currentTarget.style.transform = "scaleY(1.35)"
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scaleY(1)"
                                        }}
                                    />
                                )
                            })}
                        </div>

                        <AppCard key={current.id}>
                            <div
                                role="presentation"
                                data-nexus-quiz-protected="1"
                                {...(currentWire
                                    ? {
                                        "data-quiz-section-b64": currentWire.s64,
                                        "data-quiz-text-b64": currentWire.t64,
                                    }
                                    : {})}
                                style={protectQuizSurface}
                                onCopy={(e) => e.preventDefault()}
                                onCut={(e) => e.preventDefault()}
                                onDragStart={(e) => e.preventDefault()}
                            >
                                <div
                                    style={{
                                        display: "inline-block",
                                        fontSize: "0.72rem",
                                        fontWeight: 500,
                                        color: "rgba(255,255,255,0.4)",
                                        background: "rgba(255,255,255,0.06)",
                                        padding: "0.25em 0.75em",
                                        borderRadius: 999,
                                        marginBottom: "0.75rem",
                                    }}
                                >
                                    {current.section}
                                </div>
                                <p style={{
                                    color: "rgba(255,255,255,0.35)",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    letterSpacing: "0.08em",
                                    margin: "0 0 0.5rem"
                                }}>
                                    ВОПРОС {qIndex + 1}
                                </p>
                                <p style={{
                                    color: "#f4f4f4",
                                    fontSize: "0.95rem",
                                    fontWeight: 500,
                                    lineHeight: 1.5,
                                    margin: "0 0 1.25rem"
                                }}>
                                    {current.text}
                                </p>
                                <div className="flex flex-col gap-2">
                                    {current.options.map((opt, oi) => {
                                        const picked = answers[current.id] === oi
                                        const showCorrect = revealed && revealFb && oi === revealFb.correctIndex
                                        const showWrong = revealed && picked && !revealFb?.isCorrect
                                        let border = "1px solid rgba(255,255,255,0.1)"
                                        let background = "transparent"
                                        if (showCorrect) {
                                            border = "1px solid rgba(52,211,153,0.45)"
                                            background = "rgba(52,211,153,0.12)"
                                        } else if (showWrong) {
                                            border = "1px solid rgba(248,113,113,0.45)"
                                            background = "rgba(248,113,113,0.1)"
                                        } else if (picked && revealed) {
                                            border = "1px solid rgba(52,211,153,0.35)"
                                            background = "rgba(52,211,153,0.08)"
                                        }
                                        return (
                                            <button
                                                key={oi}
                                                type="button"
                                                disabled={revealed || submitting}
                                                onClick={() => handleOptionPick(oi)}
                                                {...(currentWire?.o64[oi] ? {"data-quiz-option-b64": currentWire.o64[oi]} : {})}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 12,
                                                    textAlign: "left",
                                                    width: "100%",
                                                    padding: "0.75em 1em",
                                                    borderRadius: 12,
                                                    border,
                                                    background,
                                                    color: "rgba(255,255,255,0.82)",
                                                    fontSize: "0.85rem",
                                                    lineHeight: 1.45,
                                                    cursor: revealed || submitting ? "default" : "pointer",
                                                    transition: "background 0.15s, border-color 0.15s",
                                                    ...protectQuizSurface,
                                                }}
                                                onCopy={(e) => e.preventDefault()}
                                                onCut={(e) => e.preventDefault()}
                                            >
                        <span
                            style={{
                                flexShrink: 0,
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: showCorrect
                                    ? "1px solid #34d399"
                                    : showWrong
                                        ? "1px solid #f87171"
                                        : "1px solid rgba(255,255,255,0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: showCorrect ? "rgba(52,211,153,0.25)" : showWrong ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.04)",
                                color: "#f4f4f4",
                            }}
                        >
                          {LETTERS[oi]}
                        </span>
                                                <span>{opt}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {revealFb && (
                                <div
                                    style={{
                                        marginTop: "1rem",
                                        padding: "0.85em 1em",
                                        borderRadius: 12,
                                        fontSize: "0.82rem",
                                        lineHeight: 1.55,
                                        border: revealFb.isCorrect ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(248,113,113,0.35)",
                                        background: revealFb.isCorrect ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.06)",
                                        color: "rgba(255,255,255,0.75)",
                                    }}
                                >
                                    <strong style={{color: revealFb.isCorrect ? "#6ee7b7" : "#fca5a5"}}>
                                        {revealFb.isCorrect
                                            ? "✓ Верно."
                                            : answers[current.id] === -1
                                                ? "✗ Время вышло."
                                                : answers[current.id] === revealFb.correctIndex
                                                    ? "✗ Ответ не засчитан (истекло время на вопрос)."
                                                    : "✗ Неверно."}
                                    </strong>{" "}
                                    {revealFb.explain}
                                </div>
                            )}

                            {serverError && (
                                <p style={{
                                    color: "#fca5a5",
                                    fontSize: "0.82rem",
                                    marginTop: "0.75rem"
                                }}>{serverError}</p>
                            )}

                            <div className="flex justify-end mt-5">
                                {revealed && qIndex < total - 1 && (
                                    <button
                                        type="button"
                                        onClick={goNext}
                                        style={{
                                            padding: "0.55em 1.25em",
                                            borderRadius: 999,
                                            border: "1px solid rgba(255,255,255,0.25)",
                                            background: "rgba(255,255,255,0.1)",
                                            color: "#f4f4f4",
                                            fontWeight: 600,
                                            fontSize: "0.85rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Следующий вопрос →
                                    </button>
                                )}
                                {revealed && qIndex >= total - 1 && (
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={finishQuiz}
                                        style={{
                                            padding: "0.55em 1.25em",
                                            borderRadius: 999,
                                            border: "1px solid rgba(52,211,153,0.4)",
                                            background: "rgba(52,211,153,0.15)",
                                            color: "#6ee7b7",
                                            fontWeight: 600,
                                            fontSize: "0.85rem",
                                            cursor: submitting ? "wait" : "pointer",
                                        }}
                                    >
                                        {submitting ? "Отправка…" : "Завершить и отправить"}
                                    </button>
                                )}
                            </div>
                        </AppCard>
                    </>
                )}

                {phase === "result" && resultFail && (
                    <AppCard>
                        <h2 style={{color: "#fca5a5", fontSize: "1.1rem", margin: "0 0 0.5rem"}}>Тест не пройден</h2>
                        <p style={{color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.5, margin: 0}}>
                            Набрано {resultFail.correctCount} из {resultFail.total} ({resultFail.percent}%). Необходимо
                            минимум {resultFail.passPercent}%.
                            {resultFail.attemptsLeft > 0 ? (
                                <>
                                    <br/>У вас осталось <strong>{resultFail.attemptsLeft}</strong> попыток.
                                </>
                            ) : null}
                            Изучите NEXUS Designer Code и попробуйте снова.
                        </p>
                        {resultFail.attemptsLeft > 0 && (
                            <button
                                type="button"
                                onClick={resetRun}
                                disabled={cooldownLeft > 0}
                                style={{
                                    marginTop: "1.25rem",
                                    padding: "0.65em 1.25em",
                                    borderRadius: 999,
                                    border: cooldownLeft > 0
                                        ? "1px solid rgba(255,255,255,0.15)"
                                        : "1px solid rgba(255,255,255,0.2)",
                                    background: cooldownLeft > 0
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(255,255,255,0.06)",
                                    color: cooldownLeft > 0 ? "rgba(255,255,255,0.5)" : "#f4f4f4",
                                    fontWeight: 500,
                                    fontSize: "0.85rem",
                                    cursor: cooldownLeft > 0 ? "not-allowed" : "pointer",
                                }}
                            >
                                {cooldownLeft > 0
                                    ? `Подождите ${cooldownLeft}с`
                                    : "Пройти снова"}
                            </button>
                        )}
                    </AppCard>
                )}

                {phase === "result" && resultExhausted && (
                    <AppCard style={{
                        border: resultExhausted.onboardingStatus === "INTERVIEW_INVITED"
                            ? "1px solid rgba(52,211,153,0.25)"
                            : "1px solid rgba(248,113,113,0.25)",
                        background: resultExhausted.onboardingStatus === "INTERVIEW_INVITED"
                            ? "rgba(52,211,153,0.06)"
                            : "rgba(248,113,113,0.06)"
                    }}>
                        <h2 style={{
                            color: resultExhausted.onboardingStatus === "INTERVIEW_INVITED" ? "#6ee7b7" : "#fca5a5",
                            fontSize: "1.1rem",
                            margin: "0 0 0.5rem"
                        }}>
                            {resultExhausted.onboardingStatus === "INTERVIEW_INVITED"
                                ? "Попытки на уровне ELITE исчерпаны"
                                : "Попытки по тесту исчерпаны"}
                        </h2>
                        <p style={{color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.5, margin: 0}}>
                            {resultExhausted.comment || (
                                resultExhausted.onboardingStatus === "INTERVIEW_INVITED"
                                    ? "Мы сохранили для вас доступ к интервью и приглашаем перейти к следующему этапу."
                                    : "К сожалению, результаты не позволяют продолжить. Предлагаем пройти обучение у наших партнёров. Список программ направим отдельным письмом."
                            )}
                        </p>
                        {resultExhausted.onboardingStatus === "INTERVIEW_INVITED" && (
                            <button
                                type="button"
                                onClick={() => router.push("/onboarding/interview")}
                                style={{
                                    marginTop: "1.25rem",
                                    padding: "0.65em 1.25em",
                                    borderRadius: 999,
                                    border: "1px solid rgba(52,211,153,0.4)",
                                    background: "rgba(52,211,153,0.15)",
                                    color: "#6ee7b7",
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                }}
                            >
                                Перейти к интервью →
                            </button>
                        )}
                        {resultExhausted.onboardingStatus === "REJECTED" && (
                            <button
                                type="button"
                                onClick={() => router.push("/onboarding")}
                                style={{
                                    marginTop: "1.25rem",
                                    padding: "0.65em 1.25em",
                                    borderRadius: 999,
                                    border: "1px solid rgba(248,113,113,0.4)",
                                    background: "rgba(248,113,113,0.15)",
                                    color: "#fca5a5",
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    cursor: "pointer",
                                }}
                            >
                                Вернуться в онбординг
                            </button>
                        )}
                    </AppCard>
                )}

                {phase === "result" && resultOk && (
                    <AppCard style={{border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.06)"}}>
                        <h2 style={{color: "#6ee7b7", fontSize: "1.1rem", margin: "0 0 0.5rem"}}>
                            {payload ? `${payload.levelTitle} пройден!` : "Тест пройден"}
                        </h2>
                        <p style={{color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", margin: 0}}>
                            Результат: {resultOk.percent}% верных ответов.
                            {resultOk.transitionText
                                ? ` ${resultOk.transitionText}`
                                : nextLevelMeta
                                    ? ` ${nextLevelMeta.title}.`
                                    : " Переход к следующему шагу…"}
                        </p>
                    </AppCard>
                )}
            </div>
        </OnboardingShell>
    )
}
