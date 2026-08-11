"use client"

import {useEffect, useState} from "react"

interface Suggestion {
    field: string | null
    tip: string
    reason: string
    example: string
}

const FIELD_LABELS: Record<string, string> = {
    objectType: "Тип объекта",
    area: "Площадь",
    address: "Адрес",
    style: "Стиль",
    materials: "Материалы и цвета",
    vision: "Образ и атмосфера",
    budget: "Бюджет",
    deadline: "Срок",
    rooms: "Помещения",
    notes: "Особые требования",
}

interface BriefAIDrawerProps {
    briefData: Record<string, string>
    onApply: (field: string, value: string) => void
}

export function BriefAIDrawer({briefData, onApply}: BriefAIDrawerProps) {
    const [open, setOpen] = useState(false)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [applied, setApplied] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchSuggestions = async () => {
        setOpen(true)
        setLoading(true)
        setError(null)
        setSuggestions([])
        setApplied(new Set())
        try {
            const res = await fetch("/api/ai/brief-suggest", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({briefData}),
            })
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setSuggestions(json.suggestions ?? [])
        } catch {
            setError("Не удалось получить подсказки. Попробуйте позже.")
        } finally {
            setLoading(false)
        }
    }

    const close = () => setOpen(false)

    const apply = (idx: number, field: string | null, example: string) => {
        if (field) onApply(field, example)
        setApplied(prev => new Set(prev).add(idx))
    }

    // Закрытие по Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    return (
        <>
            {/* Кнопка-триггер */}
            <button
                type="button"
                onClick={fetchSuggestions}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4em",
                    padding: "0.55em 1.1em",
                    borderRadius: 8,
                    border: "1.5px solid rgba(32,29,29,0.18)",
                    background: "rgba(32,29,29,0.04)",
                    color: "rgba(32,29,29,0.65)",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap" as const,
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(32,29,29,0.08)"
                    e.currentTarget.style.borderColor = "rgba(32,29,29,0.3)"
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(32,29,29,0.04)"
                    e.currentTarget.style.borderColor = "rgba(32,29,29,0.18)"
                }}
            >
                <span style={{fontSize: "0.95em"}}>✨</span>
                Подсказки AI
            </button>

            {/* Drawer root */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    overflow: "hidden",
                    pointerEvents: open ? "auto" : "none",
                    zIndex: 50,
                }}
            >
                {/* Backdrop */}
                <div
                    onClick={close}
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.25)",
                        backdropFilter: "blur(2px)",
                        opacity: open ? 1 : 0,
                        transition: "opacity 0.3s ease",
                    }}
                />

                {/* Панель */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "min(400px, 92vw)",
                        background: "#fafaf9",
                        borderLeft: "1px solid rgba(32,29,29,0.1)",
                        display: "flex",
                        flexDirection: "column" as const,
                        transform: open ? "translateX(0)" : "translateX(100%)",
                        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                        fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
                        boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
                    }}
                >
                    {/* Шапка */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1.25rem 1.5rem",
                        borderBottom: "1px solid rgba(32,29,29,0.08)",
                        flexShrink: 0,
                        background: "#fff",
                    }}>
                        <div style={{display: "flex", alignItems: "center", gap: "0.5em"}}>
                            <span style={{fontSize: "1.05rem"}}>✨</span>
                            <span style={{color: "#201d1d", fontSize: "0.95rem", fontWeight: 600}}>
                AI-подсказки
              </span>
                            <span style={{
                                background: "rgba(32,29,29,0.06)",
                                borderRadius: 100,
                                color: "rgba(32,29,29,0.4)",
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                padding: "0.2em 0.65em",
                                textTransform: "uppercase" as const,
                            }}>
                только советы
              </span>
                        </div>
                        <button
                            onClick={close}
                            style={{
                                background: "rgba(32,29,29,0.05)",
                                border: "1px solid rgba(32,29,29,0.12)",
                                borderRadius: 6,
                                color: "rgba(32,29,29,0.4)",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                lineHeight: 1,
                                padding: "0.35em 0.6em",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Контент */}
                    <div style={{flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem"}}>

                        {/* Скелетон загрузки */}
                        {loading && (
                            <div style={{display: "flex", flexDirection: "column" as const, gap: "0.75rem"}}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        background: "#fff",
                                        border: "1px solid rgba(32,29,29,0.08)",
                                        borderRadius: 10,
                                        padding: "1rem 1.1rem",
                                        animation: "brief-pulse 1.5s ease-in-out infinite",
                                    }}>
                                        <div style={{
                                            background: "rgba(32,29,29,0.07)",
                                            borderRadius: 4,
                                            height: 9,
                                            width: "35%",
                                            marginBottom: 10
                                        }}/>
                                        <div style={{
                                            background: "rgba(32,29,29,0.05)",
                                            borderRadius: 4,
                                            height: 8,
                                            width: "80%",
                                            marginBottom: 8
                                        }}/>
                                        <div style={{
                                            background: "rgba(32,29,29,0.04)",
                                            borderRadius: 4,
                                            height: 8,
                                            width: "60%"
                                        }}/>
                                    </div>
                                ))}
                                <p style={{
                                    color: "rgba(32,29,29,0.3)",
                                    fontSize: "0.78rem",
                                    textAlign: "center",
                                    margin: "0.5rem 0 0"
                                }}>
                                    Анализирую бриф…
                                </p>
                            </div>
                        )}

                        {/* Ошибка */}
                        {error && !loading && (
                            <div style={{
                                background: "rgba(220,38,38,0.05)",
                                border: "1px solid rgba(220,38,38,0.2)",
                                borderRadius: 10,
                                padding: "1rem 1.1rem",
                            }}>
                                <p style={{color: "#dc2626", fontSize: "0.875rem", margin: "0 0 0.6em"}}>{error}</p>
                                <button
                                    onClick={fetchSuggestions}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "rgba(32,29,29,0.4)",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontFamily: "inherit",
                                        padding: 0,
                                        textDecoration: "underline",
                                    }}
                                >
                                    Попробовать снова
                                </button>
                            </div>
                        )}

                        {/* Карточки подсказок */}
                        {!loading && !error && suggestions.map((s, i) => {
                            const isApplied = applied.has(i)
                            const label = s.field ? FIELD_LABELS[s.field] : null
                            return (
                                <div
                                    key={i}
                                    style={{
                                        background: isApplied ? "rgba(5,150,105,0.04)" : "#fff",
                                        border: `1px solid ${isApplied ? "rgba(5,150,105,0.2)" : "rgba(32,29,29,0.1)"}`,
                                        borderRadius: 10,
                                        marginBottom: "0.75rem",
                                        opacity: isApplied ? 0.6 : 1,
                                        padding: "1rem 1.1rem",
                                        transition: "opacity 0.3s, border-color 0.2s",
                                    }}
                                >
                                    {label && (
                                        <div style={{
                                            color: "rgba(32,29,29,0.4)",
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            letterSpacing: "0.08em",
                                            marginBottom: "0.4em",
                                            textTransform: "uppercase" as const,
                                        }}>
                                            {label}
                                        </div>
                                    )}
                                    <p style={{
                                        color: "#201d1d",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                        margin: "0 0 0.3em"
                                    }}>
                                        {s.tip}
                                    </p>
                                    <p style={{
                                        color: "rgba(32,29,29,0.5)",
                                        fontSize: "0.8rem",
                                        margin: "0 0 0.75em",
                                        lineHeight: 1.5
                                    }}>
                                        {s.reason}
                                    </p>
                                    <div style={{
                                        background: "rgba(32,29,29,0.03)",
                                        border: "1px solid rgba(32,29,29,0.07)",
                                        borderRadius: 7,
                                        marginBottom: "0.75rem",
                                        padding: "0.65rem 0.875rem",
                                    }}>
                                        <p style={{
                                            color: "rgba(32,29,29,0.6)",
                                            fontSize: "0.8rem",
                                            fontStyle: "italic",
                                            margin: 0,
                                            lineHeight: 1.5
                                        }}>
                                            «{s.example}»
                                        </p>
                                    </div>
                                    <div style={{display: "flex", justifyContent: "flex-end"}}>
                                        {isApplied ? (
                                            <span style={{color: "#059669", fontSize: "0.78rem", fontWeight: 500}}>✓ Применено</span>
                                        ) : s.field ? (
                                            <button
                                                onClick={() => apply(i, s.field, s.example)}
                                                style={{
                                                    background: "rgba(32,29,29,0.06)",
                                                    border: "1px solid rgba(32,29,29,0.15)",
                                                    borderRadius: 6,
                                                    color: "#201d1d",
                                                    cursor: "pointer",
                                                    fontSize: "0.78rem",
                                                    fontFamily: "inherit",
                                                    fontWeight: 500,
                                                    padding: "0.35em 0.9em",
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = "rgba(32,29,29,0.1)"
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = "rgba(32,29,29,0.06)"
                                                }}
                                            >
                                                Применить →
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Подвал */}
                    {!loading && suggestions.length > 0 && (
                        <div style={{
                            borderTop: "1px solid rgba(32,29,29,0.08)",
                            flexShrink: 0,
                            padding: "1rem 1.5rem",
                            background: "#fff",
                        }}>
                            <button
                                onClick={fetchSuggestions}
                                style={{
                                    background: "rgba(32,29,29,0.04)",
                                    border: "1px solid rgba(32,29,29,0.12)",
                                    borderRadius: 8,
                                    color: "rgba(32,29,29,0.5)",
                                    cursor: "pointer",
                                    fontSize: "0.8rem",
                                    fontFamily: "inherit",
                                    padding: "0.6em 1em",
                                    width: "100%",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = "rgba(32,29,29,0.08)"
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = "rgba(32,29,29,0.04)"
                                }}
                            >
                                ↺ Обновить подсказки
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes brief-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
        </>
    )
}
