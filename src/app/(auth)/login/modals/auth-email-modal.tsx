"use client"

import {AuthGlassModal} from "../auth-glass-modal"
import {inputStyle, primaryAuthButton} from "../styles"

type Props = {
    open: boolean
    onClose: () => void
    email: string
    setEmail: (v: string) => void
    password: string
    setPassword: (v: string) => void
    loading: boolean
    error: string | null
    sent: boolean
    onSubmit: () => void
    onSubmitPassword: () => void
}

export function AuthEmailModal({
                                   open,
                                   onClose,
                                   email,
                                   setEmail,
                                   password,
                                   setPassword,
                                   loading,
                                   error,
                                   sent,
                                   onSubmit,
                                   onSubmitPassword,
                               }: Props) {
    const hasPassword = password.length > 0

    return (
        <AuthGlassModal open={open} onClose={onClose} maxWidth={440}>
            <h2 style={{margin: "0 2.25rem 1rem 0", fontSize: "1.2rem", fontWeight: 500, color: "#f4f4f4"}}>
                Вход по email
            </h2>
            {sent ? (
                <p style={{fontSize: "0.95rem", lineHeight: 1.5, margin: 0, color: "rgba(255,255,255,0.88)"}}>
                    Письмо отправлено на <strong style={{color: "#fff"}}>{email.trim().toLowerCase()}</strong>
                </p>
            ) : (
                <form
                    onSubmit={(ev) => {
                        ev.preventDefault()
                        if (hasPassword) void onSubmitPassword()
                        else void onSubmit()
                    }}
                >
          <span style={{display: "block", marginBottom: 8, fontSize: "0.78rem", color: "rgba(255,255,255,0.45)"}}>
            Email
          </span>
                    <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        placeholder="you@company.com"
                        style={{...inputStyle, marginBottom: 14}}
                    />
                    <span style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: "0.78rem",
                        color: "rgba(255,255,255,0.45)"
                    }}>
            Пароль (необязательно — оставьте пустым для входа по ссылке)
          </span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        placeholder="••••••••"
                        style={{...inputStyle, marginBottom: 14}}
                    />
                    {error && <p style={{color: "#f87171", fontSize: "0.85rem", marginBottom: 12}}>{error}</p>}
                    <button type="submit" disabled={loading} style={primaryAuthButton(loading)}>
                        {loading ? "Вход…" : hasPassword ? "Войти" : "Получить ссылку"}
                    </button>
                </form>
            )}
        </AuthGlassModal>
    )
}
