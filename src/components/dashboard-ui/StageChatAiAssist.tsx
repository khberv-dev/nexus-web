"use client"

import {useCallback, useState} from "react"
import {DashRightDrawer} from "./DashRightDrawer"
import {type DashAiSuggestion, DashAiSuggestionsBody} from "./DashAiSuggestionsBody"

export function StageChatAiAssist({
                                      orderId,
                                      stageId,
                                      draft,
                                      onInsert,
                                  }: {
    orderId: string
    stageId: string
    draft: string
    onInsert: (text: string) => void
}) {
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
            const res = await fetch("/api/ai/stage-chat-suggest", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({orderId, stageId, draft}),
            })
            let json: { error?: string; suggestions?: DashAiSuggestion[] } = {}
            try {
                json = (await res.json()) as { error?: string; suggestions?: DashAiSuggestion[] }
            } catch {
                throw new Error("Ошибка ответа сервера")
            }
            if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`)
            if (json.error) throw new Error(json.error)
            setSuggestions(json.suggestions ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось получить подсказки. Попробуйте позже.")
        } finally {
            setLoading(false)
        }
    }, [orderId, stageId, draft])

    const close = () => setOpen(false)

    const apply = useCallback(
        (idx: number, _field: string | null, example: string) => {
            const t = example.trim()
            if (!t) return
            onInsert(t)
            setApplied(prev => new Set(prev).add(idx))
        },
        [onInsert],
    )

    return (
        <>
            <button
                type="button"
                onClick={() => void fetchSuggestions()}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45em",
                    padding: "0.45em 0.95em",
                    borderRadius: 8,
                    border: "1px solid var(--dash-accent-border, rgba(121,40,202,0.35))",
                    background: "var(--dash-accent-bg, rgba(121,40,202,0.08))",
                    color: "var(--dash-accent)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                <span aria-hidden>✨</span>
                ИИ для текста
            </button>

            <DashRightDrawer
                open={open}
                onClose={close}
                title="ИИ для сообщения"
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
            черновик
          </span>
                }
                zIndex={12100}
                panelWidth="min(400px, 94vw)"
                lockBodyWhenOpen={false}
                ariaLabelledBy="stage-chat-ai-drawer-title"
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
                                ↻ Обновить варианты
                            </button>
                        </div>
                    ) : undefined
                }
            >
                <DashAiSuggestionsBody
                    loading={loading}
                    loadingHint="Подбираем формулировки…"
                    error={error}
                    onRetry={() => void fetchSuggestions()}
                    suggestions={suggestions}
                    applied={applied}
                    applyMode="message"
                    onApplyExample={apply}
                    applyButtonLabel="Вставить в сообщение"
                />
            </DashRightDrawer>
        </>
    )
}
