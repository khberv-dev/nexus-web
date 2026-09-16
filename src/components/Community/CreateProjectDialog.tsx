"use client"

import {createPortal} from "react-dom"
import {useEffect, useState} from "react"

interface Props {
    open: boolean
    onCreate: (name: string) => void
    onCancel: () => void
    error?: string | null
}

export function CreateProjectDialog({open, onCreate, onCancel, error}: Props) {
    const [mounted, setMounted] = useState(false)
    const [name, setName] = useState("")

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (open) setName("")
    }, [open])

    useEffect(() => {
        if (!open) return
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel()
        }
        window.addEventListener("keydown", h)
        return () => window.removeEventListener("keydown", h)
    }, [open, onCancel])

    if (!mounted || !open) return null

    const trimmed = name.trim()
    const submit = () => {
        if (trimmed) onCreate(trimmed)
    }

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
                <h3 style={{margin: "0 0 8px", fontSize: "0.95rem", color: "var(--dash-text, #f3f5ff)"}}>
                    Новый проект
                </h3>
                <p style={{
                    margin: "0 0 14px",
                    fontSize: "0.82rem",
                    color: "var(--dash-muted, #8f95b2)",
                    lineHeight: 1.45
                }}>
                    Название папки — например, «Квартира Сокольники».
                </p>
                <input
                    autoFocus
                    className="form-control form-control-sm"
                    placeholder="Название проекта"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") submit()
                    }}
                    aria-label="Название нового проекта"
                    style={{
                        minHeight: 36,
                        background: "rgba(255,255,255,0.03)",
                        borderColor: "rgba(255,255,255,0.14)",
                        color: "var(--dash-text, #f4f4f4)",
                    }}
                />
                {error && <small className="text-danger d-block mt-2">{error}</small>}
                <div style={{display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20}}>
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
                    <button onClick={submit} disabled={!trimmed} style={{
                        padding: "6px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: trimmed ? "#5b4fcf" : "rgba(91,79,207,0.35)",
                        color: "#fff",
                        cursor: trimmed ? "pointer" : "not-allowed",
                        fontSize: "0.82rem",
                        fontFamily: "inherit",
                        fontWeight: 600
                    }}>Добавить проект
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
