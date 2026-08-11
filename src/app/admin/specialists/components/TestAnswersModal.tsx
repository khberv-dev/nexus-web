"use client"

import {Modal} from "@/components/ui/modal"
import {
    AdminTable,
    AdminTableBody,
    AdminTableCell,
    AdminTableHead,
    AdminTableHeader,
    AdminTableRow,
    AdminTableWrapper,
} from "@/components/admin/AdminTable"
import type {TestModalData} from "../types"
import {getLevelBank, QUIZ_LEVEL_ORDER} from "@/lib/onboarding/levels/banks"
import type {QuizLevelAttempt, QuizLevelCode} from "@/lib/onboarding/levels/types"
import {parseStoredTestComment} from "@/lib/onboarding/nexus-quiz"

const LEVEL_LABELS: Record<QuizLevelCode, string> = {L1: "Начинающий", L2: "Профессионал", L3: "Мастер", L4: "Элита"}

type ParsedState = { attempts: QuizLevelAttempt[]; passedLevels: QuizLevelCode[] }

function parseState(comment: string | null | undefined): ParsedState | null {
    if (!comment) return null
    try {
        const p = JSON.parse(comment) as {
            version?: number;
            attempts?: QuizLevelAttempt[];
            passedLevels?: QuizLevelCode[]
        }
        // Accept both v4 (legacy) and v5 (with admin approval gate)
        if (p.version === 4 || p.version === 5) return {attempts: p.attempts ?? [], passedLevels: p.passedLevels ?? []}
    } catch { /* ignore */
    }
    return null
}

const LETTERS = ["А", "Б", "В", "Г"]

export function TestAnswersModal({testModal, onClose}: Readonly<{
    testModal: TestModalData | null;
    onClose: () => void
}>) {
    const state = parseState(testModal?.comment)
    const attempts = state?.attempts ?? []
    const passedLevels = new Set(state?.passedLevels ?? [])
    const parsed = parseStoredTestComment(testModal?.comment ?? null)
    const detailAnswers =
        Object.keys(testModal?.answers ?? {}).length > 0 ? testModal!.answers : parsed.answers
    const detailLevel =
        parsed.currentLevel && ["L1", "L2", "L3", "L4"].includes(parsed.currentLevel)
            ? (parsed.currentLevel as QuizLevelCode)
            : attempts.length > 0
                ? (attempts[attempts.length - 1].level as QuizLevelCode)
                : null
    const detailQuestions = detailLevel ? getLevelBank(detailLevel).questions : []

    return (
        <Modal open={!!testModal} onClose={onClose} maxWidth={620}>
            <div className="sp-modal-body">
                <h5 className="sp-modal-title">Квалификационный тест (по уровням)</h5>

                {attempts.length === 0 ? (
                    <div className="sp-modal-empty">
                        <i className="bx bx-info-circle"/>
                        <p className="sp-modal-empty__title">Попыток не найдено</p>
                        <p className="sp-modal-empty__sub">Специалист ещё не проходил тест или данные в старом
                            формате.</p>
                    </div>
                ) : (
                    <>
                        {/* Summary per level */}
                        <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16}}>
                            {QUIZ_LEVEL_ORDER.map(code => {
                                const la = attempts.filter(a => a.level === code)
                                const passed = passedLevels.has(code)
                                const best = la.length ? Math.max(...la.map(a => a.percent)) : null
                                const badgeClass = passed ? "sp-badge" : la.length ? "sp-badge sp-badge--danger" : "sp-badge"
                                return (
                                    <div key={code} className="sp-card" style={{textAlign: "center", padding: 8}}>
                                        <div className="sp-label">{code}</div>
                                        <div style={{
                                            fontSize: "0.78rem",
                                            color: "var(--adm-muted)"
                                        }}>{LEVEL_LABELS[code]}</div>
                                        {la.length > 0 ? (
                                            <>
                                                <span className={badgeClass}
                                                      style={{marginTop: 4}}>{passed ? "✓ Сдан" : "✗ Не сдан"}</span>
                                                <div style={{
                                                    fontSize: "0.7rem",
                                                    color: "var(--adm-muted)",
                                                    marginTop: 2
                                                }}>
                                                    {la.length}/3 · {best}%
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{color: "var(--adm-muted)", fontSize: "0.8rem"}}>—</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Attempts table */}
                        <AdminTableWrapper>
                            <AdminTable>
                                <AdminTableHeader>
                                    <AdminTableRow>
                                        <AdminTableHead>#</AdminTableHead>
                                        <AdminTableHead>Уровень</AdminTableHead>
                                        <AdminTableHead>Результат</AdminTableHead>
                                        <AdminTableHead>Балл</AdminTableHead>
                                        <AdminTableHead>Дата</AdminTableHead>
                                    </AdminTableRow>
                                </AdminTableHeader>
                                <AdminTableBody>
                                    {attempts.map((a, i) => (
                                        <AdminTableRow key={i}>
                                            <AdminTableCell>{i + 1}</AdminTableCell>
                                            <AdminTableCell>{a.level} — {LEVEL_LABELS[a.level as QuizLevelCode] ?? a.level}</AdminTableCell>
                                            <AdminTableCell>
                        <span className={a.passed ? "sp-badge" : "sp-badge sp-badge--danger"}>
                          {a.passed ? "Сдано" : "Не сдано"}
                        </span>
                                            </AdminTableCell>
                                            <AdminTableCell>{a.correctCount}/{a.total} ({a.percent}%)</AdminTableCell>
                                            <AdminTableCell muted>
                                                {a.finishedAt ? new Date(a.finishedAt).toLocaleString("ru-RU") : "—"}
                                            </AdminTableCell>
                                        </AdminTableRow>
                                    ))}
                                </AdminTableBody>
                            </AdminTable>
                        </AdminTableWrapper>

                        {detailQuestions.length > 0 && Object.keys(detailAnswers).length > 0 && (
                            <div style={{marginTop: 16}}>
                                <div className="sp-label" style={{marginBottom: 8}}>
                                    Ответы по
                                    вопросам{detailLevel ? ` (${detailLevel} — ${LEVEL_LABELS[detailLevel]})` : ""}
                                </div>
                                <div
                                    style={{
                                        maxHeight: 280,
                                        overflowY: "auto",
                                        border: "1px solid var(--adm-sidebar-border)",
                                        borderRadius: 8,
                                        padding: "8px 10px",
                                        fontSize: "0.78rem",
                                    }}
                                >
                                    {detailQuestions.map((q) => {
                                        const saved = detailAnswers[String(q.id)]
                                        const ok = saved === q.correct
                                        const timedOut = saved === -1
                                        const picked =
                                            typeof saved === "number" && saved >= 0 ? q.options[saved] : null
                                        return (
                                            <div
                                                key={q.id}
                                                style={{
                                                    padding: "6px 0",
                                                    borderBottom: "1px solid var(--adm-sidebar-border)",
                                                    color: "var(--adm-text)",
                                                }}
                                            >
                                                <div style={{fontWeight: 600, marginBottom: 2}}>
                                                    {q.id}. {q.section}
                                                    <span
                                                        style={{
                                                            marginLeft: 8,
                                                            color: ok ? "var(--adm-success, #28c76f)" : "var(--adm-danger, #ea5455)",
                                                        }}
                                                    >
                            {saved === undefined ? "—" : timedOut ? "время" : ok ? "верно" : "неверно"}
                          </span>
                                                </div>
                                                <div style={{color: "var(--adm-muted)", lineHeight: 1.4}}>{q.text}</div>
                                                {picked && (
                                                    <div style={{marginTop: 2}}>
                                                        Выбрано ({LETTERS[saved]}): {picked}
                                                    </div>
                                                )}
                                                {!timedOut && saved !== undefined && !ok && (
                                                    <div style={{marginTop: 2, color: "var(--adm-muted)"}}>
                                                        Верно ({LETTERS[q.correct]}): {q.options[q.correct]}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="sp-modal-footer">
          <span className="sp-modal-score">
            Пройдено уровней: {passedLevels.size} из {QUIZ_LEVEL_ORDER.length} · Попыток: {attempts.length}
          </span>
                    <button className="sp-btn sp-btn-ghost" onClick={onClose} style={{marginLeft: "auto"}}>Закрыть
                    </button>
                </div>
            </div>
        </Modal>
    )
}
