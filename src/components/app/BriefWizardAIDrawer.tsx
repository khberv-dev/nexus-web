"use client"

import {useCallback, useState} from "react"
import {DashRightDrawer} from "@/components/dashboard-ui/DashRightDrawer"
import {type DashAiSuggestion, DashAiSuggestionsBody} from "@/components/dashboard-ui/DashAiSuggestionsBody"

interface BriefWizardAIDrawerProps {
    briefData: Record<string, string>
    stepKey: string
    onApply: (field: string, value: string) => void
}

const FIELD_LABELS: Record<string, string> = {
    objectType: "Тип объекта",
    companySegment: "Сегмент бизнеса",
    companyDesc: "Описание бизнеса",
    objAddress: "Адрес объекта",
    objStage: "Стадия объекта",
    objArea: "Площадь, м²",
    objFloors: "Этажей",
    objDesc: "Описание объекта",
    tasks: "Задачи проекта",
    taskMain: "Главная цель проекта",
    targetAudience: "Целевая аудитория",
    competitors: "Конкуренты / референсы",
    currentProblem: "Что не устраивает",
    styleDir: "Стиль",
    colorPalette: "Цветовая гамма",
    colorAvoid: "Нежелательные цвета",
    lightingPref: "Освещение",
    materials: "Материалы",
    styleStory: "Образ пространства",
    references: "Референсы",
    antiReferences: "Антиреференсы",
    budgetScope: "Состав бюджета",
    budgetRange: "Сумма на реализацию",
    sqmBudget: "руб./м²",
    budgetFlex: "Гибкость бюджета",
    deadlineDesign: "Срок дизайна",
    deadlineOpen: "Открытие",
    priority: "Срок vs качество",
    startReady: "Старт работ",
    constraints: "Ограничения",
    specialReqs: "Особые требования",
    additionalComments: "Комментарии",
}

export function BriefWizardAIDrawer({briefData, stepKey, onApply}: BriefWizardAIDrawerProps) {
    const [open, setOpen] = useState(false)
    const [suggestions, setSuggestions] = useState<DashAiSuggestion[]>([])
    const [applied, setApplied] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchSuggestions = useCallback(async () => {
        setOpen(true)
        setLoading(true)
        setError(null)
        setSuggestions([])
        setApplied(new Set())
        try {
            const res = await fetch("/api/ai/brief-wizard-suggest", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({briefData, stepKey}),
            })
            let json: { error?: string; suggestions?: DashAiSuggestion[] } = {}
            try {
                json = (await res.json()) as { error?: string; suggestions?: DashAiSuggestion[] }
            } catch {
                throw new Error(res.status === 503 ? "Сервер вернул не JSON (проверьте логи)." : "Ошибка ответа сервера")
            }
            if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`)
            if (json.error) throw new Error(json.error)
            setSuggestions(json.suggestions ?? [])
        } catch {
            setError("Не удалось получить подсказки. Попробуйте позже.")
        } finally {
            setLoading(false)
        }
    }, [briefData, stepKey])

    const close = () => setOpen(false)

    const onApplyExample = useCallback((idx: number, field: string | null, example: string) => {
        if (field) onApply(field, example)
        setApplied(prev => new Set(prev).add(idx))
    }, [onApply])

    return (
        <>
            <button
                type="button"
                onClick={() => void fetchSuggestions()}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45em",
                    padding: "0.55em 1em",
                    borderRadius: 8,
                    border: "1px solid var(--dash-accent-border, rgba(121,40,202,0.35))",
                    background: "var(--dash-accent-bg, rgba(121,40,202,0.08))",
                    color: "var(--dash-accent)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                <span aria-hidden>✨</span>
                Подсказки ИИ
            </button>

            <DashRightDrawer
                open={open}
                onClose={close}
                title="ИИ для этого шага"
                titleIcon={<span aria-hidden>✨</span>}
                badge={
                    <span
                        style={{
                            background: "var(--dash-surface)",
                            border: "1px solid var(--dash-border)",
                            borderRadius: 100,
                            color: "var(--dash-muted)",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            padding: "0.2em 0.55em",
                            textTransform: "uppercase",
                        }}
                    >
            советы
          </span>
                }
                zIndex={120}
                ariaLabelledBy="brief-wizard-ai-drawer-title"
                footer={
                    !loading && suggestions.length > 0 ? (
                        <div
                            style={{
                                borderTop: "1px solid var(--dash-border)",
                                padding: "0.85rem 1.25rem",
                                background: "var(--dash-surface2)",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => void fetchSuggestions()}
                                style={{
                                    background: "var(--dash-surface)",
                                    border: "1px solid var(--dash-border)",
                                    borderRadius: 8,
                                    color: "var(--dash-text2)",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                    fontFamily: "inherit",
                                    padding: "0.55em 1em",
                                    width: "100%",
                                }}
                            >
                                ↻ Обновить подсказки
                            </button>
                        </div>
                    ) : undefined
                }
            >
                <DashAiSuggestionsBody
                    loading={loading}
                    loadingHint="Анализируем ваши ответы…"
                    error={error}
                    onRetry={() => void fetchSuggestions()}
                    suggestions={suggestions}
                    applied={applied}
                    fieldLabels={FIELD_LABELS}
                    applyMode="brief"
                    onApplyExample={onApplyExample}
                    applyButtonLabel="Вставить в поле"
                />
            </DashRightDrawer>
        </>
    )
}
