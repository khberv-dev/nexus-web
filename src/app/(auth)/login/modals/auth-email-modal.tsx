"use client"

import { AuthGlassModal } from "../auth-glass-modal"
import { inputStyle, primaryAuthButton } from "../styles"

type Props = {
  open: boolean
  onClose: () => void
  email: string
  setEmail: (v: string) => void
  loading: boolean
  error: string | null
  sent: boolean
  onSubmit: () => void
}

export function AuthEmailModal({
  open,
  onClose,
  email,
  setEmail,
  loading,
  error,
  sent,
  onSubmit,
}: Props) {
  return (
    <AuthGlassModal open={open} onClose={onClose} maxWidth={440}>
      <h2 style={{ margin: "0 2.25rem 1rem 0", fontSize: "1.2rem", fontWeight: 500, color: "#f4f4f4" }}>
        Вход по email
      </h2>
      {sent ? (
        <p style={{ fontSize: "0.95rem", lineHeight: 1.5, margin: 0, color: "rgba(255,255,255,0.88)" }}>
          Письмо отправлено на <strong style={{ color: "#fff" }}>{email.trim().toLowerCase()}</strong>
        </p>
      ) : (
        <>
          <span style={{ display: "block", marginBottom: 8, fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@company.com"
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}
          <button
            type="button"
            disabled={loading}
            onClick={() => void onSubmit()}
            style={primaryAuthButton(loading)}
          >
            {loading ? "Отправка…" : "Получить ссылку"}
          </button>
        </>
      )}
    </AuthGlassModal>
  )
}
