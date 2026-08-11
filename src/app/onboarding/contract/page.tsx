"use client"

import type {CSSProperties} from "react"
import {useCallback, useEffect, useState} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"

const STATUS_HINT: Record<string, { title: string; detail: string }> = {
    NONE: {
        title: "Договор еще не размещен",
        detail: "Администратор загрузит PDF в вашей карточке. Когда файл появится, обновите страницу.",
    },
    AWAITING_SIGNATURE: {
        title: "Подпишите договор",
        detail: "Скачайте исходный PDF, подпишите его и загрузите подписанный файл обратно. При необходимости можно указать оператора ЭДО.",
    },
    SIGNED_BY_SPECIALIST: {
        title: "Подписанный файл отправлен",
        detail: "Администратор проверит загруженный PDF и подтвердит договор. После этого этап будет завершен.",
    },
    SIGNED_BY_ADMIN: {
        title: "Договор зафиксирован",
        detail: "Все этапы пройдены. Добро пожаловать на платформу!",
    },
    DECLINED_BY_SPECIALIST: {
        title: "Вы отказались от договора",
        detail: "Свяжитесь с менеджером или дождитесь новой версии документа.",
    },
}

export default function OnboardingContractPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [state, setState] = useState<{
        status: string
        number: string | null
        hasFile: boolean
        downloadUrl: string | null
        hasSignedFile: boolean
        signedDownloadUrl: string | null
    }>({
        status: "NONE",
        number: null,
        hasFile: false,
        downloadUrl: null,
        hasSignedFile: false,
        signedDownloadUrl: null,
    })
    const [edoOperator, setEdoOperator] = useState("")
    const [signedFile, setSignedFile] = useState<File | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch("/api/specialist/framework-contract")
            if (!r.ok) return
            const j = (await r.json()) as {
                status?: string
                number?: string | null
                hasFile?: boolean
                downloadUrl?: string | null
                hasSignedFile?: boolean
                signedDownloadUrl?: string | null
            }
            setState({
                status: j.status ?? "NONE",
                number: j.number ?? null,
                hasFile: Boolean(j.hasFile),
                downloadUrl: j.downloadUrl ?? null,
                hasSignedFile: Boolean(j.hasSignedFile),
                signedDownloadUrl: j.signedDownloadUrl ?? null,
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const download = (url: string | null) => {
        if (url) window.open(url, "_blank", "noopener,noreferrer")
        else void load()
    }

    const decline = async () => {
        if (!confirm("Отказаться от договора? Менеджер свяжется с вами.")) return
        setBusy(true)
        try {
            const r = await fetch("/api/specialist/framework-contract", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "decline"}),
            })
            if (!r.ok) {
                const e = await r.json().catch(() => ({}))
                alert(typeof e.error === "string" ? e.error : "Ошибка")
                return
            }
            await load()
            router.refresh()
        } finally {
            setBusy(false)
        }
    }

    const uploadSigned = async () => {
        if (!signedFile) {
            alert("Выберите подписанный PDF")
            return
        }
        setBusy(true)
        try {
            const fd = new FormData()
            fd.set("file", signedFile)
            if (edoOperator.trim()) fd.set("edoOperator", edoOperator.trim())
            const r = await fetch("/api/specialist/framework-contract", {method: "POST", body: fd})
            if (!r.ok) {
                const e = await r.json().catch(() => ({}))
                alert(typeof e.error === "string" ? e.error : "Ошибка загрузки")
                return
            }
            setSignedFile(null)
            await load()
            router.refresh()
        } finally {
            setBusy(false)
        }
    }

    const hint = STATUS_HINT[state.status] ?? {title: state.status, detail: ""}

    const inputStyle: CSSProperties = {
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        color: "#f4f4f4",
        fontSize: "0.85rem",
        padding: "0.65em 1em",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
    }

    return (
        <OnboardingShell title="Договор" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div style={{maxWidth: 720, margin: "0 auto", padding: "3rem 2rem"}}>
                <div style={{marginBottom: "2rem"}}>
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.8rem)", fontWeight: 500, margin: 0}}>
                        Договор с платформой
                    </h1>
                    <p style={{color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.9rem"}}>
                        Администратор размещает исходный документ, а вы загружаете подписанный PDF обратно для проверки.
                    </p>
                </div>

                {loading ? (
                    <AppCard>
                        <p style={{color: "rgba(255,255,255,0.5)", margin: 0}}>Загрузка...</p>
                    </AppCard>
                ) : (
                    <>
                        <AppCard style={{marginBottom: "1.25rem"}}>
                            <div style={{
                                color: "rgba(255,255,255,0.35)",
                                fontSize: "0.7rem",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                marginBottom: 8
                            }}>
                                Статус
                            </div>
                            <div style={{
                                color: "#f4f4f4",
                                fontWeight: 600,
                                fontSize: "1rem",
                                marginBottom: 8
                            }}>{hint.title}</div>
                            <p style={{
                                color: "rgba(255,255,255,0.45)",
                                fontSize: "0.88rem",
                                margin: 0,
                                lineHeight: 1.5
                            }}>{hint.detail}</p>
                            {state.number && (
                                <p style={{
                                    color: "rgba(255,255,255,0.35)",
                                    fontSize: "0.82rem",
                                    marginTop: 12,
                                    marginBottom: 0
                                }}>
                                    Номер договора: <span style={{color: "#f4f4f4"}}>{state.number}</span>
                                </p>
                            )}
                        </AppCard>

                        {state.hasFile && (
                            <AppCard style={{marginBottom: "1.25rem"}}>
                                <div style={{color: "#f4f4f4", fontWeight: 500, marginBottom: 12}}>Исходный PDF
                                    договора
                                </div>
                                <button
                                    type="button"
                                    onClick={() => download(state.downloadUrl)}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "0.75em 1.2em",
                                        background: "rgba(255,255,255,0.08)",
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        borderRadius: 10,
                                        color: "#f4f4f4",
                                        fontSize: "0.88rem",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <span>↓</span> Скачать PDF
                                </button>
                            </AppCard>
                        )}

                        {state.hasSignedFile && (
                            <AppCard style={{marginBottom: "1.25rem"}}>
                                <div style={{color: "#f4f4f4", fontWeight: 500, marginBottom: 12}}>Ваш подписанный PDF
                                </div>
                                <button
                                    type="button"
                                    onClick={() => download(state.signedDownloadUrl)}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "0.75em 1.2em",
                                        background: "rgba(52,211,153,0.12)",
                                        border: "1px solid rgba(52,211,153,0.25)",
                                        borderRadius: 10,
                                        color: "#34d399",
                                        fontSize: "0.88rem",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <span>↓</span> Скачать загруженный файл
                                </button>
                            </AppCard>
                        )}

                        {state.status === "AWAITING_SIGNATURE" && state.hasFile && (
                            <AppCard style={{marginBottom: "1.25rem"}}>
                                <label style={{
                                    display: "block",
                                    color: "rgba(255,255,255,0.45)",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    marginBottom: 8
                                }}>
                                    Оператор ЭДО
                                </label>
                                <input
                                    type="text"
                                    placeholder="Например: Контур.Диадок"
                                    value={edoOperator}
                                    onChange={(e) => setEdoOperator(e.target.value)}
                                    style={inputStyle}
                                    maxLength={500}
                                />
                                <label style={{
                                    display: "block",
                                    color: "rgba(255,255,255,0.45)",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    marginTop: 16,
                                    marginBottom: 8
                                }}>
                                    Подписанный PDF
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)}
                                    style={{...inputStyle, padding: "0.5em", background: "transparent"}}
                                />
                                <div style={{display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16}}>
                                    <button
                                        type="button"
                                        disabled={busy || !signedFile}
                                        onClick={() => void uploadSigned()}
                                        style={{
                                            padding: "0.75em 1.4em",
                                            background: "rgba(52,211,153,0.15)",
                                            border: "1px solid rgba(52,211,153,0.35)",
                                            borderRadius: 10,
                                            color: "#34d399",
                                            fontSize: "0.88rem",
                                            fontWeight: 600,
                                            cursor: busy || !signedFile ? "default" : "pointer",
                                            fontFamily: "inherit",
                                            opacity: busy || !signedFile ? 0.7 : 1,
                                        }}
                                    >
                                        {busy ? "..." : "Загрузить подписанный PDF"}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void decline()}
                                        style={{
                                            padding: "0.75em 1.4em",
                                            background: "transparent",
                                            border: "1px solid rgba(248,113,113,0.4)",
                                            borderRadius: 10,
                                            color: "#f87171",
                                            fontSize: "0.88rem",
                                            fontWeight: 500,
                                            cursor: busy ? "default" : "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        Отказаться
                                    </button>
                                </div>
                            </AppCard>
                        )}

                        <button
                            type="button"
                            onClick={() => load()}
                            style={{
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 8,
                                color: "rgba(255,255,255,0.45)",
                                fontSize: "0.82rem",
                                padding: "0.5em 1em",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Обновить статус
                        </button>

                        {state.status === "SIGNED_BY_ADMIN" && (
                            <Link
                                href="/work/community"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    marginTop: 12,
                                    padding: "0.9em 1.5em",
                                    background: "rgba(52,211,153,0.15)",
                                    border: "1px solid rgba(52,211,153,0.35)",
                                    borderRadius: 10,
                                    color: "#34d399",
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                }}
                            >
                                Перейти в личный кабинет →
                            </Link>
                        )}
                    </>
                )}
            </div>
        </OnboardingShell>
    )
}
