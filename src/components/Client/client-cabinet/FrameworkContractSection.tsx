"use client"

import {useEffect, useState} from "react"
import {confirmDialog} from "@/lib/dialog-store"
import {DocumentUpload} from "@/components/app/DocumentUpload"
import {StatusBadge} from "@/components/app/AppCard"
import {FRAMEWORK_CONTRACT_BADGE} from "./constants"
import {DocSection} from "./DocSection"
import {FrameworkContractClientGuide} from "./FrameworkContractClientGuide"

const SCAN_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
/** После ответа на договор скан больше не принимается — форма показывается заблокированной. */
const RESPONDED_STATUSES = new Set(["SIGNED_BY_CLIENT", "SIGNED_BY_ADMIN"])

type ContractState = {
    status: string
    number: string | null
    hasFile: boolean
    hasSignedFile: boolean
    signedUploadedAt: string | null
}

export function FrameworkContractSection({
                                             initial,
                                             title = "Договор оказания услуг",
                                             onStatusChange,
                                             compact = false,
                                         }: {
    initial: { status: string; number: string | null; hasFile: boolean; hasSignedFile?: boolean }
    title?: string
    onStatusChange?: (next: { status: string; number: string | null; hasFile: boolean; hasSignedFile: boolean }) => void
    compact?: boolean
}) {
    const [state, setState] = useState<ContractState>({
        ...initial,
        hasSignedFile: Boolean(initial.hasSignedFile),
        signedUploadedAt: null,
    })
    const [busy, setBusy] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const badge = FRAMEWORK_CONTRACT_BADGE[state.status] ?? {variant: "pending" as const, label: state.status}
    const awaiting = state.status === "AWAITING_SIGNATURE" && state.hasFile
    const responded = RESPONDED_STATUSES.has(state.status)

    const refresh = async () => {
        const r = await fetch("/api/client/framework-contract")
        if (!r.ok) return
        const j = (await r.json()) as {
            status: string
            number: string | null
            hasFile: boolean
            hasSignedFile?: boolean
            signedUploadedAt?: string | null
        }
        const next = {status: j.status, number: j.number, hasFile: j.hasFile, hasSignedFile: Boolean(j.hasSignedFile)}
        setState({...next, signedUploadedAt: j.signedUploadedAt ?? null})
        onStatusChange?.(next)
        return next
    }

    // Подгружаем дату скана, которой нет в серверных props.
    useEffect(() => {
        if (state.hasSignedFile && !state.signedUploadedAt) void refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const download = async () => {
        const r = await fetch("/api/client/framework-contract")
        if (!r.ok) return
        const j = (await r.json()) as { downloadUrl?: string | null }
        if (j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener,noreferrer")
    }

    /** Загружает скан по presigned URL. Бросает ошибку с текстом для пользователя. */
    const uploadScan = async (scan: File) => {
        const res = await fetch("/api/client/framework-contract", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({filename: scan.name}),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({})) as { error?: string }
            throw new Error(data.error ?? "Не удалось загрузить скан")
        }
        const {uploadUrl} = await res.json() as { uploadUrl: string }
        const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: {"Content-Type": scan.type || "application/pdf"},
            body: scan,
        })
        if (!put.ok) throw new Error("Не удалось загрузить скан")
    }

    const respond = async (action: "sign" | "decline") => {
        const ok = await confirmDialog({
            title: action === "sign" ? "Подтвердить подписание договора?" : "Отказаться от договора? Менеджер свяжется с вами.",
            description: action === "sign" ? "Это действие нельзя отменить." : undefined,
            variant: action === "decline" ? "destructive" : "warning",
        })
        if (!ok) return
        setBusy(true)
        setError(null)
        try {
            // «Подписан» отправляет выбранный скан и фиксирует подпись одним действием.
            if (action === "sign" && file) await uploadScan(file)
            const r = await fetch("/api/client/framework-contract", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action}),
            })
            if (!r.ok) {
                const data = await r.json().catch(() => ({})) as { error?: string }
                throw new Error(data.error ?? "Не удалось отправить ответ")
            }
            setFile(null)
            await refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось отправить ответ")
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    const buttonBase = {
        padding: "0.45em 1em", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1,
    } as const

    return (
        <DocSection title={title} icon="bx-file-blank">
            {!compact ? <FrameworkContractClientGuide contractStatus={state.status}/> : null}

            <div style={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10}}>
                <StatusBadge variant={badge.variant} label={badge.label}/>
                {state.number && <span style={{fontSize: "0.8rem", color: "var(--dash-muted)"}}>№ {state.number}</span>}
            </div>

            {!compact && state.status === "NONE" && !state.hasFile && (
                <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0, lineHeight: 1.45}}>
                    Администратор разместит договор в вашей карточке. После подписания вы сможете отправлять брифы на
                    рассмотрение.
                </p>
            )}

            {!compact && awaiting && (
                <p style={{fontSize: "0.82rem", color: "var(--dash-text2)", margin: "0 0 12px", lineHeight: 1.5}}>
                    Договор размещён: скачайте PDF, при необходимости приложите скан с подписью и нажмите «Подписан»
                    (или «Отказать», если не согласны — с вами свяжется менеджер).
                </p>
            )}

            {state.hasFile && (
                <div style={{marginBottom: awaiting || responded ? 12 : 0}}>
                    <button type="button" onClick={() => void download()} style={{
                        ...buttonBase, cursor: "pointer", opacity: 1,
                        border: "1px solid var(--dash-accent)", background: "var(--dash-accent-bg)", color: "var(--dash-accent)",
                    }}>
                        <i className="bx bx-download" style={{marginRight: 4}}/>Скачать PDF
                    </button>
                </div>
            )}

            {(awaiting || responded) && (
                <DocumentUpload
                    size={compact ? "sm" : "md"}
                    label={awaiting ? "Скан с подписью (необязательно)" : undefined}
                    accept={SCAN_ACCEPT}
                    formatHint="PDF, JPG или PNG, до 10,0 МБ"
                    file={file}
                    onFileChange={(f) => {
                        setFile(f)
                        setError(null)
                    }}
                    disabled={busy}
                    error={error}
                    submitted={responded ? {
                        title: "Договор подписан",
                        submittedAt: state.signedUploadedAt,
                        hint: [
                            state.hasSignedFile ? "Скан с подписью загружен" : "Подписание подтверждено без скана",
                            state.status === "SIGNED_BY_ADMIN" ? "зафиксировано менеджером" : null,
                        ].filter(Boolean).join(" · "),
                    } : null}
                />
            )}

            {awaiting && (
                <div style={{display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12}}>
                    <button type="button" disabled={busy} onClick={() => void respond("sign")} style={{
                        ...buttonBase, border: "none", background: "var(--dash-success, #2d6a2d)", color: "#fff",
                    }}>
                        {busy ? "Отправка…" : "Подписан"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void respond("decline")} style={{
                        ...buttonBase, border: "1px solid var(--dash-danger)", background: "transparent", color: "var(--dash-danger)",
                    }}>
                        Отказать
                    </button>
                </div>
            )}

            {!compact && state.status === "DECLINED_BY_CLIENT" && (
                <p style={{fontSize: "0.78rem", color: "var(--dash-warn)", margin: "8px 0 0"}}>
                    Свяжитесь с менеджером или дождитесь новой версии договора.
                </p>
            )}
        </DocSection>
    )
}
