"use client"

export type DashAiSuggestion = {
  field: string | null
  tip: string
  reason: string
  example: string
}

export type AiApplyMode = "brief" | "message"

export function DashAiSuggestionsBody({
  loading,
  loadingHint,
  error,
  onRetry,
  suggestions,
  applied,
  fieldLabels,
  applyMode,
  onApplyExample,
  applyButtonLabel,
}: {
  loading: boolean
  loadingHint?: string
  error: string | null
  onRetry: () => void
  suggestions: DashAiSuggestion[]
  applied: Set<number>
  fieldLabels?: Record<string, string>
  applyMode: AiApplyMode
  onApplyExample: (index: number, field: string | null, example: string) => void
  applyButtonLabel: string
}) {
  const showApplyButton = (s: DashAiSuggestion) => {
    if (!s.example.trim()) return false
    if (applyMode === "brief") return Boolean(s.field)
    return true
  }

  return (
    <>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                background: "var(--dash-surface2)",
                border: "1px solid var(--dash-border)",
                borderRadius: 10,
                padding: "1rem",
                animation: "dash-ai-suggestions-pulse 1.4s ease-in-out infinite",
              }}
            >
              <div style={{ background: "var(--dash-border)", borderRadius: 4, height: 8, width: "32%", marginBottom: 10 }} />
              <div style={{ background: "var(--dash-border)", borderRadius: 4, height: 7, width: "88%", marginBottom: 8, opacity: 0.7 }} />
              <div style={{ background: "var(--dash-border)", borderRadius: 4, height: 7, width: "55%", opacity: 0.5 }} />
            </div>
          ))}
          <p style={{ color: "var(--dash-muted)", fontSize: "0.78rem", textAlign: "center", margin: "0.25rem 0 0" }}>
            {loadingHint ?? "Загрузка…"}
          </p>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: "var(--dash-danger-bg, rgba(220,38,38,0.06))",
            border: "1px solid var(--dash-danger, #dc2626)",
            borderRadius: 10,
            padding: "1rem",
          }}
        >
          <p style={{ color: "var(--dash-danger)", fontSize: "0.85rem", margin: "0 0 0.5em" }}>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "none",
              border: "none",
              color: "var(--dash-accent)",
              cursor: "pointer",
              fontSize: "0.8rem",
              textDecoration: "underline",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        suggestions.map((s, i) => {
          const isApplied = applied.has(i)
          const label = s.field && fieldLabels ? fieldLabels[s.field] ?? s.field : null
          return (
            <div
              key={i}
              style={{
                background: isApplied ? "var(--dash-success-bg, rgba(45,106,45,0.08))" : "var(--dash-surface2)",
                border: `1px solid ${isApplied ? "var(--dash-success, #2d6a2d)" : "var(--dash-border)"}`,
                borderRadius: 10,
                marginBottom: "0.75rem",
                opacity: isApplied ? 0.72 : 1,
                padding: "0.95rem 1rem",
              }}
            >
              {label ? (
                <div
                  style={{
                    color: "var(--dash-muted)",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    marginBottom: "0.35em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
              ) : null}
              <p style={{ color: "var(--dash-text)", fontSize: "0.86rem", fontWeight: 600, margin: "0 0 0.25em", lineHeight: 1.35 }}>
                {s.tip}
              </p>
              <p style={{ color: "var(--dash-text2)", fontSize: "0.8rem", margin: "0 0 0.65em", lineHeight: 1.5 }}>
                {s.reason}
              </p>
              {s.example.trim() ? (
                <div
                  style={{
                    background: "var(--dash-surface)",
                    border: "1px solid var(--dash-border)",
                    borderRadius: 8,
                    marginBottom: "0.65rem",
                    padding: "0.55rem 0.75rem",
                  }}
                >
                  <p
                    style={{
                      color: "var(--dash-text2)",
                      fontSize: "0.78rem",
                      fontStyle: "italic",
                      margin: 0,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {s.example}
                  </p>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {isApplied ? (
                  <span style={{ color: "var(--dash-success, #2d6a2d)", fontSize: "0.76rem", fontWeight: 600 }}>
                    ✓ {applyMode === "message" ? "Вставлено" : "Применено"}
                  </span>
                ) : showApplyButton(s) ? (
                  <button
                    type="button"
                    onClick={() => onApplyExample(i, s.field, s.example)}
                    style={{
                      background: "var(--dash-accent)",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontFamily: "inherit",
                      fontWeight: 600,
                      padding: "0.4em 0.95em",
                    }}
                  >
                    {applyButtonLabel}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}

      <style>{`
        @keyframes dash-ai-suggestions-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </>
  )
}
