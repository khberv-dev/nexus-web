"use client"

import {type ReactNode, useState} from "react"

const border = "var(--adm-sidebar-border, rgba(0,0,0,0.08))"
const hoverBg = "var(--adm-hover-bg, rgba(0,0,0,0.03))"

interface Props {
    icon: string
    title: string
    badge?: string
    defaultOpen?: boolean
    children: ReactNode
}

export function AdminAccordion({icon, title, badge, defaultOpen = false, children}: Props) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div style={{
            marginBottom: 10,
            border: `1px solid ${border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--adm-sidebar)"
        }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "12px 14px",
                    background: hoverBg,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left"
                }}
            >
        <span style={{display: "flex", alignItems: "center", gap: 10, minWidth: 0}}>
          <i className={`bx ${icon}`} style={{fontSize: "1.15rem", color: "var(--adm-active-color)", flexShrink: 0}}/>
          <span style={{fontWeight: 600, fontSize: "0.88rem", color: "var(--adm-text)"}}>{title}</span>
            {badge && <span
                style={{fontSize: "0.72rem", color: "var(--adm-muted)", fontWeight: 500, flexShrink: 0}}>{badge}</span>}
        </span>
                <i className={`bx ${open ? "bx-chevron-up" : "bx-chevron-down"}`}
                   style={{color: "var(--adm-muted)", flexShrink: 0}}/>
            </button>
            {open && <div style={{padding: "4px 14px 14px"}}>{children}</div>}
        </div>
    )
}
