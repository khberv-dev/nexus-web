"use client"

import { signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { AppCard } from "@/components/app/AppCard"
import { explainNextAuthEmailError } from "@/lib/auth/email-signin-user-message"

const POSITION_CHIPS = [
  "Собственник", "Генеральный директор", "Управляющий",
  "Бренд-менеджер", "Архитектор / дизайнер", "Другое",
]

const OBJECT_TYPE_CHIPS = [
  "Офис", "Ресторан / кафе", "Ретейл", "Шоурум", "Фитнес / спа",
  "Гостиница", "Медицинский центр", "Другое",
]

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f4f4f4",
  fontSize: "0.9rem",
  padding: "0.7em 1em",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
}

const FIELDS = [
  { name: "email",    label: "Email",            type: "email",    placeholder: "you@company.com",   required: true },
  { name: "fullName", label: "ФИО",              type: "text",     placeholder: "Иван Иванов",        required: true },
  { name: "company",  label: "Компания",         type: "text",     placeholder: "ООО «Пространство»", required: false },
  { name: "city",     label: "Город",            type: "text",     placeholder: "Москва",             required: false },
]

export default function RegisterPage() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const toggleChip = (field: string, value: string) => {
    const current = (form[field] ?? "").split(",").map(s => s.trim()).filter(Boolean)
    const exists = current.includes(value)
    const next = exists ? current.filter(s => s !== value) : [...current, value]
    setForm(f => ({ ...f, [field]: next.join(", ") }))
  }

  const activeChips = (field: string) =>
    new Set((form[field] ?? "").split(",").map(s => s.trim()).filter(Boolean))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const email = form.email?.trim().toLowerCase()
    const fullName = form.fullName?.trim()

    if (!email || !email.includes("@")) { setError("Введите корректный email"); return }
    if (!fullName) { setError("Введите ваше ФИО"); return }

    setLoading(true)
    try {
      const pr = await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "CLIENT", name: fullName, formData: form }),
      })
      if (pr.status === 409) {
        const body = await pr.json().catch(() => ({}))
        setError(body.error ?? "Этот email уже зарегистрирован. Войдите через форму входа.")
        return
      }
      if (!pr.ok) throw new Error("pending-signup failed")
      const res = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/auth/continue",
      })
      if (res?.error) {
        setError(explainNextAuthEmailError(res.error))
        return
      }
      setSent(true)
    } catch {
      setError("Не удалось отправить запрос. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0f1535",
        zIndex: 50,
        overflowY: "auto",
        fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.1rem 2rem",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(15,21,53,0.92)",
        backdropFilter: "blur(8px)",
      }}>
        <Link href="/" style={{ color: "#f4f4f4", fontSize: "1.2rem", fontWeight: 500, textDecoration: "none" }}>
          NEXUS
        </Link>
        <Link
          href="/login"
          style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4em" }}
        >
          ← Войти
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.8rem)", fontWeight: 500, margin: 0 }}>
            Регистрация заказчика
          </h1>
        </div>

        <AppCard>
          {sent ? (
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.95rem", lineHeight: 1.55, margin: 0 }}>
              Ссылка отправлена на <strong style={{ color: "#fff" }}>{form.email?.trim().toLowerCase()}</strong>
            </p>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Text fields */}
            {FIELDS.map(field => (
              <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500 }}>
                  {field.label}{field.required && <span style={{ color: "rgba(255,100,100,0.7)", marginLeft: 3 }}>*</span>}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.name] || ""}
                  onChange={e => setForm(f => ({ ...f, [field.name]: e.target.value }))}
                  required={field.required}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
            ))}

            {/* Должность */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500 }}>
                Должность
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}>
                {POSITION_CHIPS.map(chip => {
                  const active = activeChips("position").has(chip)
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip("position", chip)}
                      style={{
                        background: active ? "rgba(121,40,202,0.3)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(121,40,202,0.55)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 100,
                        color: active ? "#e0d0ff" : "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontFamily: "inherit",
                        padding: "0.35em 0.9em",
                        transition: "all 0.15s",
                      }}
                    >
                      {active && <span style={{ marginRight: "0.3em", fontSize: "0.65rem" }}>✓</span>}
                      {chip}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Тип объекта */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500 }}>
                Тип объекта
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}>
                {OBJECT_TYPE_CHIPS.map(chip => {
                  const active = activeChips("objectType").has(chip)
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip("objectType", chip)}
                      style={{
                        background: active ? "rgba(121,40,202,0.3)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(121,40,202,0.55)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 100,
                        color: active ? "#e0d0ff" : "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontFamily: "inherit",
                        padding: "0.35em 0.9em",
                        transition: "all 0.15s",
                      }}
                    >
                      {active && <span style={{ marginRight: "0.3em", fontSize: "0.65rem" }}>✓</span>}
                      {chip}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* О задачах */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500 }}>
                О проекте / задачах
              </label>
              <textarea
                rows={4}
                placeholder="Расскажите о вашем объекте, площади, пожеланиях к стилю..."
                value={form.about || ""}
                onChange={e => setForm(f => ({ ...f, about: e.target.value }))}
                style={{ ...inputStyle, resize: "vertical" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {error && (
              <div style={{
                color: "#f87171",
                fontSize: "0.85rem",
                background: "rgba(240,20,20,0.1)",
                border: "1px solid rgba(240,20,20,0.2)",
                borderRadius: 8,
                padding: "0.6em 1em",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "#f4f4f4",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                fontWeight: 500,
                padding: "0.85em 1.5em",
                fontFamily: "inherit",
                transition: "background 0.2s",
                opacity: loading ? 0.6 : 1,
                marginTop: "0.25rem",
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = "rgba(255,255,255,0.13)") }}
              onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = "rgba(255,255,255,0.08)") }}
            >
              {loading ? "Отправка…" : "Получить ссылку на email →"}
            </button>

            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", margin: 0, textAlign: "center" }}>
              Уже есть аккаунт?{" "}
              <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
                Войти
              </Link>
            </p>
          </form>
          )}
        </AppCard>
      </div>
    </div>
  )
}
