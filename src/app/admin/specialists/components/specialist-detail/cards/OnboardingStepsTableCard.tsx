 "use client"

import { useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { parseQuizProgress, parseStoredTestComment } from "@/lib/onboarding/nexus-quiz"
import { QUIZ_QUESTIONS } from "@/app/onboarding/regulations/quiz-questions"
import { ONBOARDING_TABLE_STEP_TYPES, STEP_STATUS_RU, STEP_TYPE_RU } from "../constants"
import type { RawSpecialist } from "../../../types"

type OnboardingStepRow = NonNullable<RawSpecialist["specialistProfile"]>["steps"][number]

const FORM_LABELS: Record<string, string> = {
  fullName: "ФИО",
  phone: "Телефон",
  email: "Email",
  city: "Город",
  experience: "Опыт",
  sqm: "Реализовано м²",
  interiorStyle: "Интерьерный стиль",
  specialty: "Специализация",
  specialization: "Специализация",
  portfolio: "Портфолио",
  software: "Программы",
  about: "О себе",
  has3d: "3D моделирование",
  hasRd: "Стадия РД",
  taxStatus: "Налоговый статус",
  inn: "ИНН",
  ogrnip: "ОГРНИП",
  companyName: "Компания",
  kpp: "КПП",
  ogrn: "ОГРН",
  legalAddress: "Юр. адрес",
  bankAccount: "Р/с",
  corrAccount: "Корр. счет",
  bankName: "Банк",
  bankBik: "БИК",
}

function formatFormValue(key: string, value: string): string {
  if (key === "has3d" || key === "hasRd") return value === "true" ? "Да" : value === "false" ? "Нет" : value
  if (key === "taxStatus") return value === "IP" ? "ИП" : value === "SZ" ? "Самозанятый" : value === "OOO" ? "ООО" : value
  return value
}

export function OnboardingStepsTableCard({
  steps,
  formData,
}: {
  steps: OnboardingStepRow[]
  formData?: Record<string, string> | null
}) {
  const [viewStep, setViewStep] = useState<"FORM" | "TEST" | "REGULATIONS_READ" | "REGULATIONS" | null>(null)
  const doneCount = ONBOARDING_TABLE_STEP_TYPES.filter((t) => {
    const rec = steps.find((s) => s.type === t)
    return rec?.status === "PASSED"
  }).length
  const progress = (doneCount / ONBOARDING_TABLE_STEP_TYPES.length) * 100
  const testStep = useMemo(() => steps.find((s) => s.type === "TEST"), [steps])
  const regulationsReadStep = useMemo(() => steps.find((s) => s.type === "REGULATIONS_READ"), [steps])
  const regulationsStep = useMemo(() => steps.find((s) => s.type === "REGULATIONS"), [steps])

  return (
    <div className="sp-card">
      <div className="sp-card-hd"><span className="sp-label">Шаги онбординга</span></div>
      <div className="sp-card-bd">
        <div className="sp-onb-summary">
          <div className="sp-onb-summary__track">
            <div className="sp-onb-summary__fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="sp-onb-summary__meta">Пройдено этапов: {doneCount}/{ONBOARDING_TABLE_STEP_TYPES.length}</div>
        </div>

        <div className="sp-onb-timeline">
          {ONBOARDING_TABLE_STEP_TYPES.map((t, idx) => {
            const rec = steps.find((s) => s.type === t)
            const attemptsCount = (() => {
              if (t !== "TEST" || !rec?.comment) return 0
              try {
                const parsed = JSON.parse(rec.comment) as { version?: number; attempts?: unknown[] }
                return (parsed.version === 4 || parsed.version === 5) && Array.isArray(parsed.attempts) ? parsed.attempts.length : 0
              } catch {
                return 0
              }
            })()
            const statusLabel = rec ? (STEP_STATUS_RU[rec.status] ?? rec.status) : "Нет записи"
            const statusClass =
              rec?.status === "PASSED" ? "sp-onb-item__status--passed" :
              rec?.status === "IN_PROGRESS" ? "sp-onb-item__status--progress" :
              rec?.status === "FAILED" ? "sp-onb-item__status--failed" :
              "sp-onb-item__status--pending"
            const commentHint =
              rec?.comment == null || rec.comment === ""
                ? "Комментарий не добавлен"
                : t === "TEST"
                  ? `Ответы/прогресс теста. Попыток: ${attemptsCount || 0}`
                  : rec.comment.length > 160
                    ? `${rec.comment.slice(0, 160)}…`
                    : rec.comment
            return (
              <div key={t} className="sp-onb-item">
                <div className={`sp-onb-item__dot${rec?.status === "PASSED" ? " sp-onb-item__dot--passed" : ""}`}>
                  {rec?.status === "PASSED" ? <i className="bx bx-check" /> : idx + 1}
                </div>
                <div className="sp-onb-item__content">
                  <div className="sp-onb-item__head">
                    <div className="sp-onb-item__title">{STEP_TYPE_RU[t] ?? t}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {(t === "FORM" || t === "TEST" || t === "REGULATIONS_READ" || t === "REGULATIONS") && (
                        <button
                          type="button"
                          className="sp-btn sp-btn-ghost"
                          style={{ padding: "2px 8px", fontSize: "0.68rem" }}
                          onClick={() => setViewStep(t)}
                        >
                          Просмотр
                        </button>
                      )}
                      <span className={`sp-onb-item__status ${statusClass}`}>{statusLabel}</span>
                    </div>
                  </div>
                  <div className="sp-onb-item__sub">
                    {rec?.updatedAt ? new Date(rec.updatedAt).toLocaleString("ru-RU") : "Нет даты обновления"}
                  </div>
                  <div className="sp-onb-item__comment">{commentHint}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Modal open={!!viewStep} onClose={() => setViewStep(null)} maxWidth={640}>
        <div className="sp-modal-body" style={{ padding: "16px 18px" }}>
          <h5 className="sp-modal-title" style={{ marginBottom: 12 }}>
            {viewStep === "FORM"
              ? "Анкета специалиста"
              : viewStep === "TEST"
                ? "Квалификационный тест"
                : viewStep === "REGULATIONS_READ"
                  ? "Ознакомление с регламентом"
                  : "Тест по регламенту"}
          </h5>

          {viewStep === "FORM" && (
            <div style={{ maxHeight: "62vh", overflowY: "auto", display: "grid", gap: 6 }}>
              {Object.entries(formData ?? {})
                .filter(([, v]) => String(v ?? "").trim() !== "")
                .map(([k, v]) => (
                  <div key={k} style={{ fontSize: "0.8rem", lineHeight: 1.45, borderBottom: "1px solid var(--adm-sidebar-border)", paddingBottom: 5 }}>
                    <span style={{ color: "var(--adm-muted)" }}>{FORM_LABELS[k] ?? k}:</span>{" "}
                    <span style={{ color: "var(--adm-text)" }}>{formatFormValue(k, String(v))}</span>
                  </div>
                ))}
              {!formData || Object.values(formData).every((v) => !String(v ?? "").trim()) ? (
                <div style={{ fontSize: "0.8rem", color: "var(--adm-muted)" }}>Анкета не заполнена.</div>
              ) : null}
            </div>
          )}

          {viewStep === "TEST" && (() => {
            const parsed = parseStoredTestComment(testStep?.comment ?? null)
            const progressData = parseQuizProgress(testStep?.comment ?? null)
            const attempts = (() => {
              if (!testStep?.comment) return [] as Array<{ level?: string; percent?: number; passed?: boolean; finishedAt?: string }>
              try {
                const json = JSON.parse(testStep.comment) as { attempts?: Array<{ level?: string; percent?: number; passed?: boolean; finishedAt?: string }> }
                return Array.isArray(json.attempts) ? json.attempts : []
              } catch {
                return []
              }
            })()
            const answersCount = Object.keys(parsed.answers).length
            return (
              <div style={{ display: "grid", gap: 8, fontSize: "0.8rem" }}>
                <div><span style={{ color: "var(--adm-muted)" }}>Статус:</span> {testStep ? (STEP_STATUS_RU[testStep.status] ?? testStep.status) : "Нет записи"}</div>
                <div><span style={{ color: "var(--adm-muted)" }}>Ответов сохранено:</span> {answersCount}</div>
                {progressData && (
                  <div><span style={{ color: "var(--adm-muted)" }}>Текущий прогресс:</span> {progressData.answeredCount}/{progressData.total}, верных: {progressData.liveCorrect}</div>
                )}
                {parsed.meta && (
                  <div><span style={{ color: "var(--adm-muted)" }}>Последний результат:</span> {parsed.meta.correctCount} верных · {parsed.meta.percent}% · {parsed.meta.passed ? "сдано" : "не сдано"}</div>
                )}
                <div><span style={{ color: "var(--adm-muted)" }}>Попыток:</span> {attempts.length}</div>
                {attempts.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--adm-sidebar-border)", borderRadius: 8, padding: "8px 10px" }}>
                    {attempts.map((a, i) => (
                      <div key={`${a.finishedAt ?? i}-${i}`} style={{ padding: "5px 0", borderBottom: i < attempts.length - 1 ? "1px solid var(--adm-sidebar-border)" : "none" }}>
                        #{i + 1} · {a.level ?? "уровень"} · {a.percent ?? 0}% · {a.passed ? "сдано" : "не сдано"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {viewStep === "REGULATIONS_READ" && (
            <div style={{ display: "grid", gap: 8, fontSize: "0.8rem" }}>
              <div>
                <span style={{ color: "var(--adm-muted)" }}>Статус:</span>{" "}
                {regulationsReadStep ? (STEP_STATUS_RU[regulationsReadStep.status] ?? regulationsReadStep.status) : "Нет записи"}
              </div>
              <div style={{ color: "var(--adm-muted)" }}>
                {regulationsReadStep?.comment ? `Данные: ${regulationsReadStep.comment}` : "Комментарий отсутствует."}
              </div>
            </div>
          )}

          {viewStep === "REGULATIONS" && (() => {
            let quizResult: { score: number; total: number; pct: number; passed: boolean; sectionScores?: Record<string, { correct: number; total: number }>; answers?: Record<string, number>; finishedAt?: string } | null = null
            try {
              if (regulationsStep?.comment) quizResult = JSON.parse(regulationsStep.comment)
            } catch { /* ignore */ }

            if (!quizResult) return (
              <div style={{ display: "grid", gap: 8, fontSize: "0.8rem" }}>
                <div><span style={{ color: "var(--adm-muted)" }}>Статус:</span> {regulationsStep ? (STEP_STATUS_RU[regulationsStep.status] ?? regulationsStep.status) : "Нет записи"}</div>
                <div style={{ color: "var(--adm-muted)" }}>Результаты квиза не найдены.</div>
              </div>
            )

            const { score, total, pct, passed, sectionScores: ss, answers, finishedAt } = quizResult
            return (
              <div style={{ display: "grid", gap: 10, fontSize: "0.8rem" }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div><span style={{ color: "var(--adm-muted)" }}>Результат:</span> <strong>{score}/{total} ({pct}%)</strong></div>
                  <div><span style={{ color: "var(--adm-muted)" }}>Итог:</span> <span style={{ color: passed ? "var(--adm-success, #28c76f)" : "var(--adm-danger, #ea5455)", fontWeight: 600 }}>{passed ? "Пройдено" : "Не пройдено"}</span></div>
                  {finishedAt && <div><span style={{ color: "var(--adm-muted)" }}>Дата:</span> {new Date(finishedAt).toLocaleString("ru-RU")}</div>}
                </div>

                {ss && (
                  <div style={{ border: "1px solid var(--adm-sidebar-border)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ color: "var(--adm-muted)", marginBottom: 6, fontWeight: 600 }}>По разделам:</div>
                    {Object.entries(ss).map(([sec, v]) => {
                      const sp = Math.round((v.correct / v.total) * 100)
                      const short = sec.replace(/Раздел \d+[–—-]?\s*/i, "")
                      return (
                        <div key={sec} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--adm-sidebar-border)" }}>
                          <span style={{ color: "var(--adm-muted)" }}>{short}</span>
                          <span style={{ fontWeight: 600, color: sp < 50 ? "var(--adm-danger, #ea5455)" : "var(--adm-success, #28c76f)" }}>{v.correct}/{v.total}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {answers && (
                  <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--adm-sidebar-border)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ color: "var(--adm-muted)", marginBottom: 6, fontWeight: 600 }}>Ответы по вопросам:</div>
                    {Object.entries(answers).map(([idxStr, picked]) => {
                      const idx = Number(idxStr)
                      const q = QUIZ_QUESTIONS[idx]
                      if (!q) return null
                      const isCorrect = picked === q.correct
                      return (
                        <div key={idx} style={{ padding: "6px 0", borderBottom: "1px solid var(--adm-sidebar-border)" }}>
                          <div style={{ color: "var(--adm-text)", marginBottom: 2 }}>{idx + 1}. {q.text}</div>
                          <div style={{ color: isCorrect ? "var(--adm-success, #28c76f)" : "var(--adm-danger, #ea5455)", fontSize: "0.75rem" }}>
                            {isCorrect ? "✓" : "✗"} {q.options[picked] ?? "—"}
                            {!isCorrect && <span style={{ color: "var(--adm-muted)", marginLeft: 8 }}>Верно: {q.options[q.correct]}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          <div className="sp-modal-footer" style={{ marginTop: 14 }}>
            <button className="sp-btn sp-btn-ghost" onClick={() => setViewStep(null)} style={{ marginLeft: "auto" }}>
              Закрыть
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
