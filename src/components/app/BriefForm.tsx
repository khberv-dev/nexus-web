"use client"

import { useState } from "react"

// ─── Типы ────────────────────────────────────────────────────────────────────

interface Suggestion {
  field: string | null
  tip: string
  reason: string
  example: string
}

interface BriefFormProps {
  orderId: string
  initialData: Record<string, string>
  editable?: boolean
}

// ─── Поля брифа ──────────────────────────────────────────────────────────────

const BRIEF_FIELDS = [
  { key: "area",     label: "Площадь",             placeholder: "Например: 65 м²",                   hint: "Общая площадь помещения" },
  { key: "style",    label: "Стиль",                placeholder: "Скандинавский, лофт, классика…",    hint: "Желаемый стиль интерьера" },
  { key: "budget",   label: "Бюджет",               placeholder: "Например: 500 000 — 800 000 руб.",     hint: "Общий бюджет на проект" },
  { key: "rooms",    label: "Помещения",             placeholder: "Гостиная, спальня, кухня…",         hint: "Перечислите все комнаты" },
  { key: "deadline", label: "Срок",                  placeholder: "Например: 3 месяца",                hint: "Желаемый срок выполнения" },
  { key: "address",  label: "Адрес",                 placeholder: "Город, район или полный адрес",     hint: "Для выезда дизайнера" },
  { key: "notes",    label: "Особые требования",     placeholder: "Дети, животные, аллергии…",         hint: "Любые важные детали" },
]

// ─── Стили ────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "1.5rem",
    marginBottom: "1rem",
  } as React.CSSProperties,

  label: {
    display: "block",
    color: "rgba(255,255,255,0.45)",
    fontSize: "0.72rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    marginBottom: "0.4em",
  } as React.CSSProperties,

  hint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "0.75rem",
    marginTop: "0.3em",
  } as React.CSSProperties,

  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#f4f4f4",
    fontSize: "0.9rem",
    padding: "0.65em 0.875em",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  } as React.CSSProperties,

  inputDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  } as React.CSSProperties,

  btnPrimary: {
    background: "rgba(121,40,202,0.75)",
    border: "1px solid rgba(121,40,202,0.5)",
    borderRadius: 8,
    color: "#f4f4f4",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    padding: "0.6em 1.4em",
    fontFamily: "inherit",
    transition: "background 0.2s",
  } as React.CSSProperties,

  btnGhost: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.6)",
    cursor: "pointer",
    fontSize: "0.875rem",
    padding: "0.6em 1.2em",
    fontFamily: "inherit",
    transition: "background 0.2s",
  } as React.CSSProperties,

  suggestionCard: {
    background: "rgba(121,40,202,0.07)",
    border: "1px solid rgba(121,40,202,0.2)",
    borderRadius: 10,
    padding: "1rem 1.1rem",
    marginBottom: "0.75rem",
  } as React.CSSProperties,

  appliedCard: {
    background: "rgba(52,211,153,0.06)",
    border: "1px solid rgba(52,211,153,0.2)",
    borderRadius: 10,
    padding: "1rem 1.1rem",
    marginBottom: "0.75rem",
    opacity: 0.6,
  } as React.CSSProperties,
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export function BriefForm({ orderId, initialData, editable = true }: BriefFormProps) {
  const [data, setData]           = useState<Record<string, string>>(initialData)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [applied, setApplied]     = useState<Set<number>>(new Set())
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)
  const [showAI, setShowAI]       = useState(false)

  const handleChange = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/orders/${orderId}/brief`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const handleAI = async () => {
    setLoadingAI(true)
    setAiError(null)
    setSuggestions([])
    setApplied(new Set())
    setShowAI(true)

    try {
      const res = await fetch("/api/ai/brief-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefData: data }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSuggestions(json.suggestions ?? [])
    } catch {
      setAiError("Не удалось получить подсказки. Попробуйте позже.")
    } finally {
      setLoadingAI(false)
    }
  }

  const applySuggestion = (idx: number, field: string | null, example: string) => {
    if (field && editable) handleChange(field, example)
    setApplied(prev => new Set(prev).add(idx))
  }

  const fieldLabel = (key: string | null) =>
    BRIEF_FIELDS.find(f => f.key === key)?.label ?? null

  return (
    <div>
      {/* ── Заголовок ── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ color: "#f4f4f4", fontSize: "1.25rem", fontWeight: 500, margin: 0 }}>
          Бриф проекта
        </h2>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", marginTop: "0.3em" }}>
          {editable
            ? "Заполните детали — чем точнее бриф, тем лучше результат"
            : "Бриф передан дизайнеру"}
        </p>
      </div>

      {/* ── Поля ── */}
      <div style={S.card}>
        {BRIEF_FIELDS.map(({ key, label, placeholder, hint }) => (
          <div key={key} style={{ marginBottom: "1.25rem" }}>
            <label style={S.label}>{label}</label>
            <input
              value={data[key] ?? ""}
              onChange={e => handleChange(key, e.target.value)}
              disabled={!editable}
              placeholder={placeholder}
              style={{ ...S.input, ...(!editable ? S.inputDisabled : {}) }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(121,40,202,0.5)" }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
            />
            <p style={S.hint}>{hint}</p>
          </div>
        ))}
      </div>

      {/* ── Кнопки действий ── */}
      {editable && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <button onClick={handleSave} disabled={saving} style={S.btnPrimary}>
            {saving ? "Сохранение…" : saved ? "Сохранено ✓" : "Сохранить"}
          </button>

          <button
            onClick={handleAI}
            disabled={loadingAI}
            style={{
              ...S.btnGhost,
              display: "flex",
              alignItems: "center",
              gap: "0.4em",
            }}
          >
            <span style={{ fontSize: "1em" }}>✨</span>
            {loadingAI ? "Анализирую…" : "Подсказки AI"}
          </button>
        </div>
      )}

      {/* ── AI-подсказки ── */}
      {showAI && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
              <span style={{ fontSize: "1rem" }}>✨</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                AI-предложения
              </span>
              <span style={{ background: "rgba(121,40,202,0.25)", borderRadius: 100, color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", padding: "0.15em 0.6em" }}>
                только подсказки
              </span>
            </div>
            <button
              onClick={() => setShowAI(false)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "1rem", padding: 0 }}
            >
              ✕
            </button>
          </div>

          {loadingAI && (
            <div style={{ ...S.card, textAlign: "center", padding: "2rem" }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.875rem" }}>
                Анализирую бриф…
              </div>
            </div>
          )}

          {aiError && (
            <div style={{ ...S.card, borderColor: "rgba(240,20,20,0.25)", background: "rgba(240,20,20,0.05)" }}>
              <p style={{ color: "rgba(255,100,100,0.8)", fontSize: "0.875rem", margin: 0 }}>{aiError}</p>
            </div>
          )}

          {suggestions.map((s, i) => {
            const isApplied = applied.has(i)
            const label = fieldLabel(s.field)

            return (
              <div key={i} style={isApplied ? S.appliedCard : S.suggestionCard}>
                {label && (
                  <div style={{ color: "rgba(121,40,202,0.9)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4em" }}>
                    {label}
                  </div>
                )}
                <p style={{ color: "#f4f4f4", fontSize: "0.875rem", fontWeight: 500, margin: "0 0 0.3em" }}>
                  {s.tip}
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", margin: "0 0 0.75em" }}>
                  {s.reason}
                </p>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", fontStyle: "italic", margin: 0, flex: 1 }}>
                    «{s.example}»
                  </p>
                  {!isApplied && editable && s.field && (
                    <button
                      onClick={() => applySuggestion(i, s.field, s.example)}
                      style={{
                        background: "rgba(121,40,202,0.2)",
                        border: "1px solid rgba(121,40,202,0.35)",
                        borderRadius: 6,
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: "0.3em 0.8em",
                        fontFamily: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      Применить →
                    </button>
                  )}
                  {isApplied && (
                    <span style={{ color: "rgba(52,211,153,0.7)", fontSize: "0.75rem", flexShrink: 0 }}>✓ Применено</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
