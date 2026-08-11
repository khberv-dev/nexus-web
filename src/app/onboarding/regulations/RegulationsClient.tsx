"use client"

import {useCallback, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"
import {QUIZ_QUESTIONS} from "./quiz-questions"

const LETTERS = ["А", "Б", "В", "Г"] as const
const TOTAL = QUIZ_QUESTIONS.length

function initSectionScores() {
    const s: Record<string, { correct: number; total: number }> = {}
    for (const q of QUIZ_QUESTIONS) {
        if (!s[q.section]) s[q.section] = {correct: 0, total: 0}
        s[q.section].total++
    }
    return s
}

export default function RegulationsClient() {
    const router = useRouter()
    const [phase, setPhase] = useState<"loading" | "intro" | "quiz" | "result">("loading")
    const [qIndex, setQIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [sectionScores, setSectionScores] = useState(initSectionScores)
    const [picked, setPicked] = useState<number | null>(null)
    const [revealFb, setRevealFb] = useState<{ isCorrect: boolean; correctIndex: number; explain: string } | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [allAnswers, setAllAnswers] = useState<Record<number, number>>({})

    // Load resume on mount
    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch("/api/onboarding/regulations-result")
                const data = await res.json()
                if (data.resume) {
                    const {answers, score: savedScore, sectionScores: savedSections} = data.resume as {
                        answers: Record<string, number>
                        score: number
                        sectionScores: Record<string, { correct: number; total: number }>
                    }
                    const answeredIndices = Object.keys(answers).map(Number)
                    if (answeredIndices.length > 0) {
                        const numericAnswers: Record<number, number> = {}
                        for (const [k, v] of Object.entries(answers)) numericAnswers[Number(k)] = v
                        setAllAnswers(numericAnswers)
                        setScore(savedScore)
                        if (savedSections) setSectionScores(savedSections)
                        // Resume at first unanswered question
                        const nextIdx = QUIZ_QUESTIONS.findIndex((_, i) => numericAnswers[i] === undefined)
                        const resumeIdx = nextIdx === -1 ? TOTAL - 1 : nextIdx
                        setQIndex(resumeIdx)
                        setPhase("quiz")
                        return
                    }
                }
            } catch { /* ignore, start fresh */
            }
            setPhase("intro")
        })()
    }, [])

    const q = QUIZ_QUESTIONS[qIndex]
    const isAnswered = revealFb !== null
    const progressPct = phase === "result" ? 100 : Math.round((qIndex / TOTAL) * 100)

    const selectAnswer = useCallback(async (idx: number) => {
        if (isAnswered || submitting) return
        setSubmitting(true)
        try {
            const res = await fetch("/api/onboarding/regulations-result/reveal", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({questionIndex: qIndex, selectedIndex: idx}),
            })
            const data = await res.json()
            setAllAnswers(prev => ({...prev, [qIndex]: idx}))
            setPicked(idx)
            if (data.isCorrect) {
                setScore(s => s + 1)
                setSectionScores(prev => {
                    const sec = QUIZ_QUESTIONS[qIndex].section
                    return {...prev, [sec]: {...prev[sec], correct: prev[sec].correct + 1}}
                })
            }
            setRevealFb({
                isCorrect: Boolean(data.isCorrect),
                correctIndex: Number(data.correctIndex),
                explain: String(data.explain ?? "")
            })
        } finally {
            setSubmitting(false)
        }
    }, [isAnswered, submitting, qIndex])

    const goNext = useCallback(async () => {
        if (qIndex < TOTAL - 1) {
            setQIndex(i => i + 1)
            setPicked(null)
            setRevealFb(null)
        } else {
            setSubmitting(true)
            const finalAnswers = {...allAnswers}
            const finalScore = score
            const finalPct = Math.round((finalScore / TOTAL) * 100)
            const finalPassed = finalPct >= 80
            await fetch("/api/onboarding/regulations-result", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    score: finalScore,
                    total: TOTAL,
                    pct: finalPct,
                    passed: finalPassed,
                    sectionScores,
                    answers: finalAnswers
                }),
            })
            setSubmitting(false)
            setPhase("result")
        }
    }, [qIndex, score, allAnswers, sectionScores])

    const restart = () => {
        setPhase("intro");
        setQIndex(0);
        setScore(0);
        setPicked(null)
        setRevealFb(null);
        setAllAnswers({});
        setSectionScores(initSectionScores())
    }

    const pct = Math.round((score / TOTAL) * 100)
    const passed = pct >= 80

    return (
        <OnboardingShell title="Регламенты" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div className="mx-auto max-w-xl px-6 py-12">

                {/* ── LOADING ── */}
                {phase === "loading" && (
                    <p style={{color: "rgba(255,255,255,0.45)", fontSize: "0.9rem"}}>Загрузка…</p>
                )}

                {/* ── INTRO ── */}
                {phase === "intro" && (
                    <>
                        <div className="mb-8">
                            <h1 style={{
                                color: "#f4f4f4",
                                fontSize: "clamp(1.4rem,3vw,1.8rem)",
                                fontWeight: 500,
                                margin: 0
                            }}>
                                Шаг 4 — Регламенты платформы
                            </h1>
                            <p style={{color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.9rem"}}>
                                Тест на знание NEXUS Designer Code. Ответьте на {TOTAL} вопросов по всем разделам
                                регламента.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-8 mb-8"
                             style={{color: "rgba(255,255,255,0.5)", fontSize: "0.85rem"}}>
                            {[["30", "вопросов"], ["13", "разделов"], ["80%", "проходной балл"]].map(([num, label]) => (
                                <div key={label}>
                                    <div style={{
                                        color: "#f4f4f4",
                                        fontSize: "1.75rem",
                                        fontWeight: 600,
                                        lineHeight: 1
                                    }}>{num}</div>
                                    <div>{label}</div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setPhase("quiz")}
                            style={{
                                width: "100%",
                                padding: "0.85em 1.5em",
                                borderRadius: 999,
                                border: "1px solid rgba(255,255,255,0.25)",
                                background: "rgba(255,255,255,0.1)",
                                color: "#f4f4f4",
                                fontWeight: 600,
                                fontSize: "0.9rem",
                                cursor: "pointer"
                            }}
                        >
                            Начать тест →
                        </button>
                    </>
                )}

                {/* ── QUIZ ── */}
                {phase === "quiz" && (
                    <>
                        <div className="mb-4 flex justify-between items-center" style={{fontSize: "0.82rem"}}>
                            <span style={{color: "rgba(255,255,255,0.45)"}}>Вопрос {qIndex + 1} из {TOTAL}</span>
                            <span style={{color: "rgba(255,255,255,0.65)", fontWeight: 600}}>{score} верных</span>
                        </div>
                        <div style={{
                            height: 6,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.08)",
                            overflow: "hidden",
                            marginBottom: "1.5rem"
                        }}>
                            <div style={{
                                height: "100%",
                                width: `${progressPct}%`,
                                borderRadius: 999,
                                background: "linear-gradient(90deg, rgba(52,211,153,0.9), rgba(45,212,191,0.85))",
                                transition: "width 0.35s cubic-bezier(0.16,1,0.3,1)"
                            }}/>
                        </div>

                        <AppCard key={qIndex}>
                            <div style={{
                                display: "inline-block",
                                fontSize: "0.72rem",
                                fontWeight: 500,
                                color: "rgba(255,255,255,0.4)",
                                background: "rgba(255,255,255,0.06)",
                                padding: "0.25em 0.75em",
                                borderRadius: 999,
                                marginBottom: "0.75rem"
                            }}>
                                {q.section}
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
                                {q.text}
                            </p>

                            <div className="flex flex-col gap-2">
                                {q.options.map((opt, i) => {
                                    const isCorrect = isAnswered && revealFb && i === revealFb.correctIndex
                                    const isWrong = isAnswered && i === picked && !revealFb?.isCorrect
                                    let border = "1px solid rgba(255,255,255,0.1)"
                                    let background = "transparent"
                                    if (isCorrect) {
                                        border = "1px solid rgba(52,211,153,0.45)";
                                        background = "rgba(52,211,153,0.12)"
                                    }
                                    if (isWrong) {
                                        border = "1px solid rgba(248,113,113,0.45)";
                                        background = "rgba(248,113,113,0.1)"
                                    }
                                    return (
                                        <button key={i} type="button" disabled={isAnswered || submitting}
                                                onClick={() => selectAnswer(i)}
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
                                                    cursor: isAnswered || submitting ? "default" : "pointer"
                                                }}>
                      <span style={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: isCorrect ? "1px solid #34d399" : isWrong ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          background: isCorrect ? "rgba(52,211,153,0.25)" : isWrong ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.04)",
                          color: "#f4f4f4"
                      }}>
                        {LETTERS[i]}
                      </span>
                                            <span>{opt}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {revealFb && (
                                <div style={{
                                    marginTop: "1rem",
                                    padding: "0.85em 1em",
                                    borderRadius: 12,
                                    fontSize: "0.82rem",
                                    lineHeight: 1.55,
                                    border: revealFb.isCorrect ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(248,113,113,0.35)",
                                    background: revealFb.isCorrect ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.06)",
                                    color: "rgba(255,255,255,0.75)"
                                }}>
                                    <strong style={{color: revealFb.isCorrect ? "#6ee7b7" : "#fca5a5"}}>
                                        {revealFb.isCorrect ? "✓ Верно." : "✗ Неверно."}
                                    </strong>{" "}{revealFb.explain}
                                </div>
                            )}

                            {isAnswered && (
                                <div className="flex justify-end mt-5">
                                    <button type="button" disabled={submitting} onClick={goNext}
                                            style={{
                                                padding: "0.55em 1.25em",
                                                borderRadius: 999,
                                                border: "1px solid rgba(52,211,153,0.4)",
                                                background: "rgba(52,211,153,0.15)",
                                                color: "#6ee7b7",
                                                fontWeight: 600,
                                                fontSize: "0.85rem",
                                                cursor: submitting ? "wait" : "pointer"
                                            }}>
                                        {submitting ? "Сохранение…" : qIndex < TOTAL - 1 ? "Следующий вопрос →" : "Завершить тест →"}
                                    </button>
                                </div>
                            )}
                        </AppCard>
                    </>
                )}

                {/* ── RESULT ── */}
                {phase === "result" && (
                    <>
                        <AppCard style={{
                            border: passed ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(248,113,113,0.25)",
                            background: passed ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)"
                        }}>
                            <h2 style={{
                                color: passed ? "#6ee7b7" : "#fca5a5",
                                fontSize: "1.1rem",
                                margin: "0 0 0.5rem"
                            }}>
                                {passed ? "Тест пройден!" : "Тест не пройден"}
                            </h2>
                            <p style={{color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", margin: "0 0 1rem"}}>
                                Результат: <strong style={{color: "#f4f4f4"}}>{score}</strong> из {TOTAL} ({pct}%).
                                {passed ? " Регламент принят." : " Рекомендуем повторно изучить NEXUS Designer Code."}
                            </p>

                            <div style={{
                                borderTop: "1px solid rgba(255,255,255,0.07)",
                                paddingTop: "0.75rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6
                            }}>
                                {Object.entries(sectionScores).map(([sec, v]) => {
                                    const sp = Math.round((v.correct / v.total) * 100)
                                    const shortSec = sec.replace(/Раздел \d+[–—-]?\s*/i, "")
                                    return (
                                        <div key={sec} style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            fontSize: "0.8rem"
                                        }}>
                                            <span style={{color: "rgba(255,255,255,0.45)"}}>{shortSec}</span>
                                            <span style={{
                                                fontWeight: 600,
                                                color: sp < 50 ? "#fca5a5" : "#6ee7b7"
                                            }}>{v.correct}/{v.total}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </AppCard>

                        <div className="flex flex-col gap-3 mt-2">
                            <button type="button" onClick={restart}
                                    style={{
                                        width: "100%",
                                        padding: "0.85em 1.5em",
                                        borderRadius: 999,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        background: "rgba(255,255,255,0.06)",
                                        color: "#f4f4f4",
                                        fontWeight: 500,
                                        fontSize: "0.85rem",
                                        cursor: "pointer"
                                    }}>
                                Пройти заново
                            </button>
                            {passed && (
                                <button type="button" onClick={() => router.push("/onboarding")}
                                        style={{
                                            width: "100%",
                                            padding: "0.85em 1.5em",
                                            borderRadius: 999,
                                            border: "1px solid rgba(52,211,153,0.4)",
                                            background: "rgba(52,211,153,0.15)",
                                            color: "#6ee7b7",
                                            fontWeight: 600,
                                            fontSize: "0.9rem",
                                            cursor: "pointer"
                                        }}>
                                    Следующий шаг →
                                </button>
                            )}
                        </div>
                    </>
                )}

            </div>
        </OnboardingShell>
    )
}
