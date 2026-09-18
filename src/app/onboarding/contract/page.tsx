"use client"

import type {CSSProperties} from "react"
import {useCallback, useEffect, useState} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {toast} from "sonner"
import {confirmDialog} from "@/lib/dialog-store"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"
import {SPECIALIST_CABINET_HOME_HREF} from "@/lib/cabinet-shell"
import {DocumentUpload} from "@/components/app/DocumentUpload"
import {uploadWithProgress} from "@/lib/upload-progress"

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
        signedUploadedAt: string | null
    }>({
        status: "NONE",
        number: null,
        hasFile: false,
        downloadUrl: null,
        hasSignedFile: false,
        signedDownloadUrl: null,
        signedUploadedAt: null,
    })
    const [edoOperator, setEdoOperator] = useState("")
    const [signedFile, setSignedFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)

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
                signedUploadedAt?: string | null
            }
            setState({
                status: j.status ?? "NONE",
                number: j.number ?? null,
                hasFile: Boolean(j.hasFile),
                downloadUrl: j.downloadUrl ?? null,
                hasSignedFile: Boolean(j.hasSignedFile),
                signedDownloadUrl: j.signedDownloadUrl ?? null,
                signedUploadedAt: j.signedUploadedAt ?? null,
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
        const ok = await confirmDialog({
            title: "Отказаться от договора? Менеджер свяжется с вами.",
            variant: "destructive",
        })
        if (!ok) return
        setBusy(true)
        try {
            const r = await fetch("/api/specialist/framework-contract", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "decline"}),
            })
            if (!r.ok) {
                const e = await r.json().catch(() => ({}))
                toast.error(typeof e.error === "string" ? e.error : "Ошибка")
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
            setUploadError("Выберите подписанный PDF")
            return
        }
        setBusy(true)
        setUploadError(null)
        setUploadProgress(0)
        try {
            const fd = new FormData()
            fd.set("file", signedFile)
            if (edoOperator.trim()) fd.set("edoOperator", edoOperator.trim())
            const r = await uploadWithProgress("/api/specialist/framework-contract", fd, {
                onProgress: ({percent}) => setUploadProgress(percent),
            })
            if (!r.ok) {
                let message = "Ошибка загрузки"
                try {
                    const e = JSON.parse(r.text || "{}") as { error?: string }
                    if (typeof e.error === "string") message = e.error
                } catch { /* ответ не JSON — оставляем общий текст */ }
                setUploadError(message)
                return
            }
            setSignedFile(null)
            await load()
            router.refresh()
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Ошибка загрузки")
        } finally {
            setUploadProgress(null)
            setBusy(false)
        }
    }

    // После отправки подписанного файла форма остаётся на месте, но заблокирована.
    const awaitingSignature = state.status === "AWAITING_SIGNATURE"
    const signedSubmitted = !awaitingSignature && state.hasSignedFile

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
                    <AppCard glass>
                        <p style={{color: "rgba(255,255,255,0.5)", margin: 0}}>Загрузка...</p>
                    </AppCard>
                ) : (
                    <>
                        <AppCard glass style={{marginBottom: "1.25rem"}}>
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
                            <AppCard glass style={{marginBottom: "1.25rem"}}>
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

                        {state.hasFile && (awaitingSignature || signedSubmitted) && (
                            <AppCard glass style={{marginBottom: "1.25rem"}}>
                                {awaitingSignature && (
                                    <>
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
                                            style={{...inputStyle, ...(busy ? {opacity: 0.6, cursor: "not-allowed"} : {})}}
                                            maxLength={500}
                                            disabled={busy}
                                        />
                                    </>
                                )}
                                <div style={{marginTop: awaitingSignature ? 16 : 0}}>
                                    <DocumentUpload
                                        label="Подписанный PDF"
                                        file={signedFile}
                                        onFileChange={(f) => {
                                            setSignedFile(f)
                                            setUploadError(null)
                                        }}
                                        progress={uploadProgress}
                                        error={uploadError}
                                        disabled={busy}
                                        submitted={signedSubmitted ? {
                                            title: "Подписанный договор отправлен",
                                            submittedAt: state.signedUploadedAt,
                                            hint: state.status === "SIGNED_BY_ADMIN"
                                                ? "Договор подтверждён администратором"
                                                : "Ожидает проверки администратором",
                                            onDownload: state.signedDownloadUrl
                                                ? () => download(state.signedDownloadUrl)
                                                : undefined,
                                        } : null}
                                    />
                                </div>
                                {awaitingSignature && (
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
                                                cursor: busy || !signedFile ? "not-allowed" : "pointer",
                                                fontFamily: "inherit",
                                                opacity: busy || !signedFile ? 0.6 : 1,
                                            }}
                                        >
                                            {busy ? "Отправка…" : "Отправить подписанный PDF"}
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
                                                cursor: busy ? "not-allowed" : "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            Отказаться
                                        </button>
                                    </div>
                                )}
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
                                href={SPECIALIST_CABINET_HOME_HREF}
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
