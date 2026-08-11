"use client"

import {type ReactNode, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import {registerDashDrawerEscape} from "./dashDrawerEscapeStack"

export function DashRightDrawer({
                                    open,
                                    onClose,
                                    title,
                                    badge,
                                    titleIcon,
                                    children,
                                    footer,
                                    zIndex = 1200,
                                    panelWidth = "min(420px, 94vw)",
                                    lockBodyWhenOpen = true,
                                    closeOnEscape = true,
                                    ariaLabelledBy,
                                    panelId,
                                    /** false: без вертикального скролла обёртки — скролл только у дочернего контента (чат). */
                                    scrollableBody = true,
                                    themeVars,
                                }: {
    open: boolean
    onClose: () => void
    title: ReactNode
    badge?: ReactNode
    titleIcon?: ReactNode
    children: ReactNode
    footer?: ReactNode
    zIndex?: number
    panelWidth?: string
    lockBodyWhenOpen?: boolean
    closeOnEscape?: boolean
    ariaLabelledBy?: string
    panelId?: string
    scrollableBody?: boolean
    themeVars?: React.CSSProperties
}) {
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!open || !closeOnEscape) return
        return registerDashDrawerEscape(() => onCloseRef.current())
    }, [open, closeOnEscape])

    useEffect(() => {
        if (!open || !lockBodyWhenOpen) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [open, lockBodyWhenOpen])

    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const layer = (
        <div
            className="dash-theme-scope"
            style={{
                position: "fixed",
                inset: 0,
                overflow: "hidden",
                pointerEvents: open ? "auto" : "none",
                zIndex,
                ...(themeVars ?? {}),
            }}
            aria-hidden={!open}
        >
            <button
                type="button"
                tabIndex={open ? 0 : -1}
                aria-label="Закрыть панель"
                onClick={() => onCloseRef.current()}
                style={{
                    position: "absolute",
                    inset: 0,
                    margin: 0,
                    padding: 0,
                    border: "none",
                    cursor: open ? "pointer" : "default",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    opacity: open ? 1 : 0,
                    transition: "opacity 0.25s ease",
                }}
            />
            <div
                id={panelId}
                role="dialog"
                aria-modal={open ? true : undefined}
                aria-labelledby={ariaLabelledBy}
                onClick={e => e.stopPropagation()}
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: panelWidth,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    background: "var(--dash-surface, #fff)",
                    borderLeft: "1px solid var(--dash-border, rgba(0,0,0,0.12))",
                    display: "flex",
                    flexDirection: "column",
                    transform: open ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: "-12px 0 40px rgba(0,0,0,0.12)",
                    fontFamily: "inherit",
                    paddingRight: "env(safe-area-inset-right, 0)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "1rem 1.25rem",
                        borderBottom: "1px solid var(--dash-border, rgba(0,0,0,0.12))",
                        flexShrink: 0,
                        background: "var(--dash-surface2, rgba(0,0,0,0.02))",
                    }}
                >
                    <div style={{display: "flex", alignItems: "center", gap: "0.4em", flexWrap: "wrap", minWidth: 0}}>
                        {titleIcon != null ? <span style={{fontSize: "1rem", flexShrink: 0}}>{titleIcon}</span> : null}
                        <span {...(ariaLabelledBy ? {id: ariaLabelledBy} : {})}
                              style={{color: "var(--dash-text)", fontSize: "0.92rem", fontWeight: 600}}>
              {title}
            </span>
                        {badge}
                    </div>
                    <button
                        type="button"
                        onClick={() => onCloseRef.current()}
                        style={{
                            flexShrink: 0,
                            background: "var(--dash-surface, #fff)",
                            border: "1px solid var(--dash-border, rgba(0,0,0,0.12))",
                            borderRadius: 8,
                            color: "var(--dash-muted)",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            lineHeight: 1,
                            padding: "0.35em 0.55em",
                        }}
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowX: "hidden",
                        overflowY: scrollableBody ? "auto" : "hidden",
                        padding: scrollableBody ? "1rem 1.25rem" : "1rem 1.25rem max(1rem, calc(env(safe-area-inset-bottom, 0px) + 12px))",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {children}
                </div>

                {footer != null ? <div style={{flexShrink: 0}}>{footer}</div> : null}
            </div>
        </div>
    )

    if (!mounted) return layer
    return createPortal(layer, document.body)
}
