"use client"

import {type ReactNode, useState} from "react"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

// Фолбэки на случай, если компонент рендерится вне .adm-root (например, внутри Modal,
// который порталит содержимое в document.body — там --adm-* переменные не наследуются).
const border = "var(--adm-sidebar-border, #334155)"
const hoverBg = "var(--adm-hover-bg, rgba(129,140,248,0.10))"

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
            background: "var(--adm-sidebar, #1e293b)"
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
                    textAlign: "left",
                    // Кнопки не наследуют цвет текста от предков по умолчанию — без этого дети ниже
                    // (у которых var(--adm-text) тоже не резолвится вне .adm-root) падают на чёрный.
                    color: "inherit",
                }}
            >
        <span style={{display: "flex", alignItems: "center", gap: 10, minWidth: 0}}>
          <Icon name={stripBx(icon)} style={{fontSize: "1.15rem", color: "var(--adm-active-color, #818cf8)", flexShrink: 0}}/>
          <span style={{fontWeight: 600, fontSize: "0.88rem", color: "var(--adm-text, #f1f5f9)"}}>{title}</span>
            {badge && <span
                style={{fontSize: "0.72rem", color: "var(--adm-muted, #94a3b8)", fontWeight: 500, flexShrink: 0}}>{badge}</span>}
        </span>
                <Icon name={stripBx(open ? "bx-chevron-up" : "bx-chevron-down")}
                   style={{color: "var(--adm-muted, #94a3b8)", flexShrink: 0}}/>
            </button>
            {open && <div style={{padding: "4px 14px 14px"}}>{children}</div>}
        </div>
    )
}
