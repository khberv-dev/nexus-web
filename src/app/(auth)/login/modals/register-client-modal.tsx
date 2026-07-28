"use client"

import Link from "next/link"
import { PhoneField } from "@/components/ui/PhoneField"
import { AuthGlassModal } from "../auth-glass-modal"
import { CLIENT_MODAL_FIELDS, LEGAL_PERSONAL_DATA_HREF } from "../constants"
import { inputStyle, primaryAuthButton } from "../styles"

type Props = {
  open: boolean
  onClose: () => void
  regForm: Record<string, string>
  setRegForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  regLoading: boolean
  regError: string | null
  regSent: boolean
  dataConsent: boolean
  setDataConsent: (v: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  onSwitchToLogin: () => void
}

const consentLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  cursor: "pointer",
  fontSize: "0.82rem",
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.72)",
  marginBottom: 14,
}

const linkStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.88)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
}

export function RegisterClientModal({
  open,
  onClose,
  regForm,
  setRegForm,
  regLoading,
  regError,
  regSent,
  dataConsent,
  setDataConsent,
  onSubmit,
  onSwitchToLogin,
}: Props) {
  return (
    <AuthGlassModal open={open} onClose={onClose} maxWidth={440}>
      <h2 style={{ margin: "0 2.25rem 1rem 0", fontSize: "1.2rem", fontWeight: 500 }}>Регистрация заказчика</h2>
      {regSent ? (
        <p style={{ fontSize: "0.95rem", lineHeight: 1.5, margin: 0 }}>
          Ссылка на <strong style={{ color: "#fff" }}>{regForm.email?.trim().toLowerCase()}</strong>
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          {CLIENT_MODAL_FIELDS.map((field) => (
            <div key={field.name} style={{ marginBottom: 12 }}>
              <span style={{ display: "block", marginBottom: 6, fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>
                {field.label}
                {field.required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
              </span>
              <input
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                value={regForm[field.name] || ""}
                onChange={(ev) => setRegForm((f) => ({ ...f, [field.name]: ev.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>
              Телефон<span style={{ color: "#f87171", marginLeft: 3 }}>*</span>
            </span>
            <PhoneField
              value={regForm.phone || ""}
              onChange={(v) => setRegForm((f) => ({ ...f, phone: v }))}
              required
              className="onb-phone"
            />
          </div>
          <label style={consentLabelStyle}>
            <input
              type="checkbox"
              checked={dataConsent}
              onChange={(ev) => setDataConsent(ev.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: "pointer", accentColor: "#a78bfa" }}
            />
            <span>
              Я принимаю{" "}
              <Link href={LEGAL_PERSONAL_DATA_HREF} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                политику конфиденциальности и условия обработки персональных данных
              </Link>
              <span style={{ color: "#f87171", marginLeft: 2 }}>*</span>
            </span>
          </label>
          {regError && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 10 }}>{regError}</p>}
          {regError?.includes("уже зарегистрированы") && (
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{
                width: "100%",
                marginBottom: 10,
                padding: "0.6em 1em",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.28)",
                background: "rgba(255,255,255,0.06)",
                color: "#f4f4f4",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Войти
            </button>
          )}
          <button type="submit" disabled={regLoading} style={primaryAuthButton(regLoading)}>
            {regLoading ? "Отправка…" : "Получить ссылку на email"}
          </button>
        </form>
      )}
    </AuthGlassModal>
  )
}
