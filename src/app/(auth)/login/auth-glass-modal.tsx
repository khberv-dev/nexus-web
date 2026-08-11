"use client"

import {useEffect} from "react"
import {createPortal} from "react-dom"
import {AUTH_FONT, GLASS_CARD} from "./constants"

type Props = {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    maxWidth?: number
}

export function AuthGlassModal({open, onClose, children, maxWidth = 440}: Props) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", onKey)
        document.body.style.overflow = "hidden"
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = ""
        }
    }, [open, onClose])

    if (!open || typeof document === "undefined") return null

    return createPortal(
        <div
            role="presentation"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.58)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                fontFamily: AUTH_FONT,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth,
                    maxHeight: "min(88vh, 720px)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    color: "#f4f4f4",
                    ...GLASS_CARD,
                }}
            >
                <button
                    type="button"
                    aria-label="Закрыть"
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: 12,
                        right: 14,
                        zIndex: 2,
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.75)",
                        fontSize: "1.35rem",
                        lineHeight: 1,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                    }}
                >
                    ×
                </button>
                <div
                    style={{
                        padding: "1.35rem 2.75rem 1.5rem 1.25rem",
                        overflowY: "auto",
                        overflowX: "hidden",
                        flex: 1,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>,
        document.body
    )
}
