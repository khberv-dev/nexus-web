"use client"

import {useState} from "react"

const ROLES = [
    {
        role: "CLIENT",
        label: "Заказчик",
        icon: "bx-briefcase",
        color: "#6366f1",
        desc: "Создание проекта, заполнение брифа, согласование этапов"
    },
    {
        role: "SPECIALIST",
        label: "Специалист",
        icon: "bx-palette",
        color: "#f59e0b",
        desc: "Онбординг с нуля, тест, интервью, выполнение заказов"
    },
    {
        role: "ADMIN",
        label: "Администратор",
        icon: "bx-shield",
        color: "#22c55e",
        desc: "Текущий аккаунт админа — управление платформой"
    },
] as const

const ROLE_REDIRECT: Record<string, string> = {
    CLIENT: "/orders",
    SPECIALIST: "/onboarding",
    ADMIN: "/admin",
}

export default function DemoPage() {
    const [key, setKey] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [resetting, setResetting] = useState(false)
    const [resetDone, setResetDone] = useState(false)

    const handleLogin = async (role: string) => {
        if (!key.trim()) {
            setError("Введите ключ доступа");
            return
        }
        setLoading(role);
        setError(null)
        try {
            const res = await fetch("/api/demo/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({key: key.trim(), role}),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                setError(d.error ?? "Ошибка входа")
                setLoading(null)
                return
            }
            window.location.href = ROLE_REDIRECT[role] ?? "/"
        } catch {
            setError("Ошибка сети")
            setLoading(null)
        }
    }

    const handleReset = async () => {
        if (!key.trim()) {
            setError("Введите ключ доступа");
            return
        }
        if (!confirm("Удалить все demo-аккаунты (заказчик + специалист) и их данные? Это необратимо.")) return
        setResetting(true);
        setError(null);
        setResetDone(false)
        try {
            const res = await fetch("/api/demo/reset", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({key: key.trim()}),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                setError(d.error ?? "Ошибка сброса")
            } else {
                setResetDone(true)
            }
        } catch {
            setError("Ошибка сети")
        } finally {
            setResetting(false)
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "#0c0e1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1rem"
        }}>
            <div style={{maxWidth: 720, width: "100%"}}>
                <div style={{textAlign: "center", marginBottom: 40}}>
                    <h1 style={{
                        color: "#f4f4f4",
                        fontSize: "2rem",
                        fontWeight: 700,
                        margin: "0 0 8px",
                        letterSpacing: "0.04em"
                    }}>NEXUS Demo</h1>
                    <p style={{color: "rgba(255,255,255,0.45)", fontSize: "0.9rem"}}>Выберите роль для входа на
                        платформу</p>
                </div>

                <div style={{display: "flex", justifyContent: "center", marginBottom: 32}}>
                    <input
                        type="password"
                        placeholder="Ключ доступа"
                        value={key}
                        onChange={e => {
                            setKey(e.target.value);
                            setError(null)
                        }}
                        style={{
                            width: 280,
                            padding: "0.7em 1em",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                            color: "#f4f4f4",
                            fontSize: "0.9rem",
                            fontFamily: "inherit",
                            outline: "none",
                            textAlign: "center",
                        }}
                    />
                </div>

                <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32}}>
                    {ROLES.map(r => (
                        <button
                            key={r.role}
                            type="button"
                            disabled={!!loading}
                            onClick={() => handleLogin(r.role)}
                            style={{
                                padding: "2rem 1.25rem", borderRadius: 16,
                                border: `1px solid ${r.color}33`, background: `${r.color}0a`,
                                cursor: loading ? "wait" : "pointer", textAlign: "center",
                                transition: "transform 0.15s, border-color 0.15s",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = `${r.color}66`;
                                e.currentTarget.style.transform = "translateY(-2px)"
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = `${r.color}33`;
                                e.currentTarget.style.transform = "translateY(0)"
                            }}
                        >
                            <i className={`bx ${r.icon}`}
                               style={{fontSize: "2rem", color: r.color, display: "block", marginBottom: 12}}/>
                            <div style={{
                                color: "#f4f4f4",
                                fontSize: "1rem",
                                fontWeight: 600,
                                marginBottom: 6
                            }}>{r.label}</div>
                            <div style={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: "0.78rem",
                                lineHeight: 1.4
                            }}>{r.desc}</div>
                            {loading === r.role &&
                                <div style={{color: r.color, fontSize: "0.8rem", marginTop: 10}}>Вход…</div>}
                        </button>
                    ))}
                </div>

                {error && (
                    <div style={{
                        textAlign: "center",
                        color: "#fca5a5",
                        fontSize: "0.85rem",
                        marginBottom: 16
                    }}>{error}</div>
                )}
                {resetDone && (
                    <div style={{textAlign: "center", color: "#6ee7b7", fontSize: "0.85rem", marginBottom: 16}}>✓
                        Demo-данные удалены</div>
                )}

                <div style={{textAlign: "center"}}>
                    <button
                        type="button"
                        disabled={resetting}
                        onClick={handleReset}
                        style={{
                            padding: "0.55em 1.5em", borderRadius: 999,
                            border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)",
                            color: "#fca5a5", fontSize: "0.82rem", fontWeight: 500,
                            cursor: resetting ? "wait" : "pointer", fontFamily: "inherit",
                        }}
                    >
                        <i className="bx bx-trash" style={{marginRight: 6}}/>
                        {resetting ? "Удаление…" : "Сбросить demo-данные"}
                    </button>
                </div>
            </div>
        </div>
    )
}
