"use client"

import {createPortal} from "react-dom"
import {useEffect, useState} from "react"

interface Props {
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({open, title, message, confirmLabel = "Удалить", onConfirm, onCancel}: Props) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!open) return
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel()
        }
        window.addEventListener("keydown", h)
        return () => window.removeEventListener("keydown", h)
    }, [open, onCancel])

    if (!mounted || !open) return null

    return createPortal(
        <div onClick={onCancel} style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: "var(--dash-surface, #0d1230)",
                border: "1px solid var(--dash-border, rgba(255,255,255,0.1))",
                borderRadius: 14,
                padding: "24px 28px",
                maxWidth: 380,
                width: "90vw"
            }}>
                <h3 style={{margin: "0 0 8px", fontSize: "0.95rem", color: "var(--dash-text, #f3f5ff)"}}>{title}</h3>
                {message && <p style={{
                    margin: "0 0 20px",
                    fontSize: "0.82rem",
                    color: "var(--dash-muted, #8f95b2)",
                    lineHeight: 1.45
                }}>{message}</p>}
                <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                    <button onClick={onCancel} style={{
                        padding: "6px 16px",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: "var(--dash-text)",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        fontFamily: "inherit"
                    }}>Отмена
                    </button>
                    <button onClick={onConfirm} style={{
                        padding: "6px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "#ea5455",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        fontFamily: "inherit",
                        fontWeight: 600
                    }}>{confirmLabel}</button>
                </div>
            </div>
        </div>,
        document.body
    )
}
