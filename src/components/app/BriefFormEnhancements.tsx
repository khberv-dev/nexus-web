// Компонент для визуализации индикаторов загрузки ИИ в полях брифа
import React from "react"

interface AILoadingIndicatorProps {
  isLoading: boolean
  fieldKey: string
  position?: "right" | "bottom"
}

export function AILoadingIndicator({ isLoading, fieldKey, position = "right" }: AILoadingIndicatorProps) {
  if (!isLoading) return null

  if (position === "bottom") {
    return (
      <div
        style={{
          marginTop: "0.5em",
          display: "flex",
          alignItems: "center",
          gap: "0.5em",
          fontSize: "0.75rem",
          color: "rgba(121,40,202,0.7)",
        }}
      >
        <div
          style={{
            display: "inline-block",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "rgba(121,40,202,0.7)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            display: "inline-block",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "rgba(121,40,202,0.5)",
            animation: "pulse 1.5s ease-in-out 0.3s infinite",
          }}
        />
        <div
          style={{
            display: "inline-block",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "rgba(121,40,202,0.3)",
            animation: "pulse 1.5s ease-in-out 0.6s infinite",
          }}
        />
        <span>ИИ анализирует…</span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4em",
        marginLeft: "0.5em",
        padding: "0.3em 0.6em",
        background: "rgba(121,40,202,0.1)",
        borderRadius: 4,
        fontSize: "0.7rem",
        color: "rgba(121,40,202,0.8)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          width: "3px",
          height: "3px",
          borderRadius: "50%",
          background: "rgba(121,40,202,0.8)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <span>Анализирую…</span>
    </div>
  )
}

// CSS для анимации пульса
export const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
`

// Компонент для отображения статуса применения подсказки
interface SuggestionStatusProps {
  isApplied: boolean
  isLoading?: boolean
}

export function SuggestionStatus({ isApplied, isLoading }: SuggestionStatusProps) {
  if (isLoading) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3em",
          fontSize: "0.75rem",
          color: "rgba(121,40,202,0.7)",
        }}
      >
        <div
          style={{
            width: "3px",
            height: "3px",
            borderRadius: "50%",
            background: "rgba(121,40,202,0.7)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        Применение…
      </div>
    )
  }

  if (isApplied) {
    return (
      <span style={{ color: "rgba(52,211,153,0.7)", fontSize: "0.75rem", fontWeight: 600 }}>
        ✓ Применено
      </span>
    )
  }

  return null
}

// Компонент для отображения ошибки ИИ
interface AIErrorProps {
  error: string | null
  onDismiss?: () => void
}

export function AIError({ error, onDismiss }: AIErrorProps) {
  if (!error) return null

  return (
    <div
      style={{
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 8,
        padding: "0.875rem 1rem",
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "rgba(239,68,68,0.8)",
        fontSize: "0.875rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
        <span style={{ fontSize: "1.1em" }}>⚠️</span>
        <span>{error}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "rgba(239,68,68,0.6)",
            cursor: "pointer",
            fontSize: "1.2em",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// Компонент для отображения подсказки ИИ с анимацией
interface AnimatedSuggestionProps {
  suggestion: {
    field: string | null
    tip: string
    reason: string
    example: string
  }
  index: number
  isApplied: boolean
  onApply: () => void
  editable: boolean
  fieldLabel?: string | null
}

export function AnimatedSuggestion({
  suggestion,
  index,
  isApplied,
  onApply,
  editable,
  fieldLabel,
}: AnimatedSuggestionProps) {
  const S = {
    suggestionCard: {
      background: "rgba(121,40,202,0.07)",
      border: "1px solid rgba(121,40,202,0.2)",
      borderRadius: 10,
      padding: "1rem 1.1rem",
      marginBottom: "0.75rem",
      animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
    } as React.CSSProperties,
    appliedCard: {
      background: "rgba(52,211,153,0.06)",
      border: "1px solid rgba(52,211,153,0.2)",
      borderRadius: 10,
      padding: "1rem 1.1rem",
      marginBottom: "0.75rem",
      opacity: 0.6,
      animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
    } as React.CSSProperties,
  }

  return (
    <div style={isApplied ? S.appliedCard : S.suggestionCard}>
      {fieldLabel && (
        <div style={{ color: "rgba(121,40,202,0.9)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4em" }}>
          {fieldLabel}
        </div>
      )}
      <p style={{ color: "#f4f4f4", fontSize: "0.875rem", fontWeight: 500, margin: "0 0 0.3em" }}>
        {suggestion.tip}
      </p>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", margin: "0 0 0.75em" }}>
        {suggestion.reason}
      </p>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", fontStyle: "italic", margin: 0, flex: 1 }}>
          «{suggestion.example}»
        </p>
        {!isApplied && editable && suggestion.field && (
          <button
            onClick={onApply}
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
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(121,40,202,0.35)"
              e.currentTarget.style.color = "rgba(255,255,255,0.9)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(121,40,202,0.2)"
              e.currentTarget.style.color = "rgba(255,255,255,0.7)"
            }}
          >
            Применить →
          </button>
        )}
        {isApplied && (
          <span style={{ color: "rgba(52,211,153,0.7)", fontSize: "0.75rem", flexShrink: 0 }}>
            ✓ Применено
          </span>
        )}
      </div>
    </div>
  )
}

// CSS для анимации слайда
export const slideInKeyframes = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`
