"use client"
import React, {useCallback, useEffect} from "react"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

// ─── Card ────────────────────────────────────────────────────────────────────

interface AppCardProps {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
    /**
     * Стеклянная карточка (полупрозрачный фон + блюр фона позади неё), не завязанная на
     * `sneat/core.css` — нужна на страницах онбординга, где этот стиль не подключён.
     */
    glass?: boolean
}

export function AppCard({children, className = "", style, glass = false}: AppCardProps) {
    if (glass) {
        return (
            <div
                className={className}
                style={{
                    background: "rgba(10,14,32,0.55)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderRadius: 16,
                    padding: "1.5rem",
                    ...style,
                }}
            >
                {children}
            </div>
        )
    }
    return (
        <div className={`card ${className}`} style={style}>
            <div className="card-body">
                {children}
            </div>
        </div>
    )
}

// ─── Section label ───────────────────────────────────────────────────────────

export function SectionLabel({children}: { children: React.ReactNode }) {
    return (
        <p className="text-uppercase text-muted fw-semibold mb-3"
           style={{fontSize: "0.72rem", letterSpacing: "0.08em"}}>
            {children}
        </p>
    )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export type StatusVariant = "active" | "pending" | "done" | "rejected" | "current"

const BADGE_CLASS: Record<StatusVariant, string> = {
    current: "bg-label-warning",
    active: "bg-label-info",
    done: "bg-label-success",
    pending: "bg-label-secondary",
    rejected: "bg-label-danger",
}

export function StatusBadge({variant, label}: { variant: StatusVariant; label: string }) {
    return (
        <span className={`badge rounded-pill ${BADGE_CLASS[variant]}`}>
      {label}
    </span>
    )
}

// ─── Info row ─────────────────────────────────────────────────────────────────

export function InfoRow({icon, label, value, href}: { icon: string; label: string; value: string; href?: string }) {
    return (
        <div className="d-flex align-items-start gap-2 mb-2">
            <Icon name={stripBx(icon)} className="text-muted mt-1"/>
            <div>
                <div className="text-uppercase text-muted"
                     style={{fontSize: "0.7rem", letterSpacing: "0.05em"}}>{label}</div>
                {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary"
                       style={{fontSize: "0.875rem"}}>{value}</a>
                ) : (
                    <div style={{fontSize: "0.875rem"}}>{value}</div>
                )}
            </div>
        </div>
    )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface AppModalProps {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    maxWidth?: number
    /** Тёмная панель (кабинет); по умолчанию светлая как в админских формах. */
    variant?: "light" | "dark"
}

export function AppModal({open, onClose, children, maxWidth = 900, variant = "light"}: AppModalProps) {
    const handleKey = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") onClose()
    }, [onClose])

    useEffect(() => {
        if (open) {
            document.addEventListener("keydown", handleKey)
            document.body.style.overflow = "hidden"
        }
        return () => {
            document.removeEventListener("keydown", handleKey)
            document.body.style.overflow = ""
        }
    }, [open, handleKey])

    if (!open) return null

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 1050,
                background: "rgba(0,0,0,0.72)", display: "flex",
                alignItems: "center", justifyContent: "center", padding: 16,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={
                    variant === "dark"
                        ? {
                            background: "linear-gradient(165deg, rgba(26,31,58,0.98) 0%, rgba(15,19,38,0.99) 100%)",
                            color: "#e8eaf4",
                            borderRadius: 16,
                            width: "100%",
                            maxWidth,
                            maxHeight: "92vh",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            animation: "modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                        }
                        : {
                            background: "#fff",
                            borderRadius: 16,
                            width: "100%",
                            maxWidth,
                            maxHeight: "92vh",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            animation: "modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                        }
                }
            >
                {children}
                <style>{`@keyframes modal-in { from { transform: scale(0.93); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
            </div>
        </div>
    )
}

// ─── Action button ────────────────────────────────────────────────────────────

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "ghost" | "danger"
    icon?: string
    children: React.ReactNode
}

export function ActionButton({variant = "ghost", icon, children, className = "", ...props}: ActionButtonProps) {
    const cls = variant === "primary" ? "btn btn-primary" : variant === "danger" ? "btn btn-danger" : "btn btn-outline-secondary"
    return (
        <button {...props} className={`${cls} ${className}`}>
            {icon && <Icon name={stripBx(icon)} className="me-1"/>}
            {children}
        </button>
    )
}
