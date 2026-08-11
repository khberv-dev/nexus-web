"use client"

import {type CSSProperties, useEffect, useRef} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import {BRIEF_WIZARD_STEP_COUNT, briefWizardStepLabel} from "@/lib/clientBriefDisplay"
import {orderListRowHint} from "./order-list-hint"
import type {Order, OrderStatus} from "./types"
import {ORDER_LABEL, ORDER_VARIANT} from "./types"

function hintStyle(kind: ReturnType<typeof orderListRowHint>["kind"]): CSSProperties {
    const base: CSSProperties = {
        fontSize: "0.68rem",
        lineHeight: 1.35,
        marginTop: 4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    }
    switch (kind) {
        case "admin":
            return {...base, color: "#fbbf24", fontWeight: 500}
        case "designer":
            return {...base, color: "color-mix(in srgb, #38bdf8 85%, var(--adm-text))"}
        case "client":
            return {...base, color: "color-mix(in srgb, #c4b5fd 88%, var(--adm-text))"}
        default:
            return {...base, color: "var(--adm-muted)"}
    }
}

interface Props {
    filtered: Order[]
    loading: boolean
    selected: string | null
    search: string
    filter: OrderStatus | "ALL"
    onSelect: (id: string) => void
    onSearch: (q: string) => void
    onFilter: (f: OrderStatus | "ALL") => void
}

const FILTERS: { value: OrderStatus | "ALL"; label: string }[] = [
    {value: "ALL", label: "Все"},
    {value: "DRAFT", label: "Черновик"},
    {value: "BRIEFING", label: "Бриф"},
    {value: "BRIEF_REVIEW", label: "Проверка"},
    {value: "ACTIVE", label: "Активен"},
    {value: "DONE", label: "Завершен"},
    {value: "CANCELLED", label: "Отменен"},
]

export function OrderList({filtered, loading, selected, search, filter, onSelect, onSearch, onFilter}: Props) {
    const scrollTargetRef = useRef<string | null>(null)

    useEffect(() => {
        if (loading || !selected) return
        if (scrollTargetRef.current === selected) return
        scrollTargetRef.current = selected
        requestAnimationFrame(() => {
            document.getElementById(`admin-order-row-${selected}`)?.scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            })
        })
    }, [loading, selected])

    return (
        <aside className="sp-list">
            <div className="sp-list-hd">
                <span className="sp-label">Заказы</span>
                <span className="sp-badge">{filtered.length}</span>
            </div>
            <div className="sp-search">
                <i className="bx bx-search sp-search-icon"/>
                <input type="text" className="sp-search-input" placeholder="Поиск…" value={search}
                       onChange={e => onSearch(e.target.value)}/>
            </div>
            <div className="sp-filters">
                {FILTERS.map(f => (
                    <button key={f.value} className={`sp-filter-btn${filter === f.value ? " sp-filter-btn--on" : ""}`}
                            onClick={() => onFilter(f.value)}>{f.label}</button>
                ))}
            </div>

            {loading && <div className="sp-empty">Загрузка…</div>}
            {!loading && filtered.length === 0 && <div className="sp-empty">Заказов нет</div>}

            {!loading && filtered.map(o => {
                const isActive = o.id === selected || (!selected && o === filtered[0])
                const title = o.title ?? o.briefData?.name ?? `Заказ #${o.id.slice(-6)}`
                const modStages = o.stages.filter(s => s.status === "MOD_REVIEW")
                const needsAssign = !o.specialist && o.status !== "DRAFT" && o.status !== "CANCELLED"
                const isDraft = o.status === "DRAFT"
                const showMetaRow = modStages.length > 0 || needsAssign || o.briefHelpRequested || isDraft
                const hint = orderListRowHint(o)

                return (
                    <div
                        key={o.id}
                        id={`admin-order-row-${o.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(o.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelect(o.id)
                            }
                        }}
                        className={`sp-item${isActive ? " sp-item--on" : ""}`}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 4
                        }}>
                            <div style={{minWidth: 0}}>
                                <div style={{
                                    fontWeight: 600,
                                    fontSize: "0.82rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>{title}</div>
                                <div style={{
                                    fontSize: "0.72rem",
                                    color: "var(--adm-muted)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>{o.client.name ?? o.client.email}</div>
                                {hint.text ? (
                                    <div style={hintStyle(hint.kind)} title={hint.text}>
                                        {hint.text}
                                    </div>
                                ) : null}
                            </div>
                            <StatusBadge variant={ORDER_VARIANT[o.status]} label={ORDER_LABEL[o.status]}/>
                        </div>
                        {showMetaRow && (
                            <div style={{display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap"}}>
                                {isDraft && (
                                    <span
                                        className="sp-badge"
                                        style={{
                                            fontSize: "0.6rem",
                                            background: "color-mix(in srgb, var(--adm-active-color) 16%, transparent)",
                                            color: "var(--adm-active-color)",
                                            border: "1px solid color-mix(in srgb, var(--adm-active-color) 35%, transparent)",
                                        }}
                                        title={`Этап брифа: ${briefWizardStepLabel(o.briefStep)}`}
                                    >
                    <i className="bx bx-edit-alt" style={{marginRight: 3}}/>
                    бриф {Math.min(o.briefStep + 1, BRIEF_WIZARD_STEP_COUNT)}/{BRIEF_WIZARD_STEP_COUNT}
                  </span>
                                )}
                                {o.briefHelpRequested &&
                                    <span className="sp-badge sp-badge--danger" style={{fontSize: "0.6rem"}}><i
                                        className="bx bx-support" style={{marginRight: 3}}/>помощь</span>}
                                {modStages.length > 0 &&
                                    <span className="sp-badge sp-badge--danger" style={{fontSize: "0.6rem"}}><i
                                        className="bx bx-time" style={{marginRight: 3}}/>модерация</span>}
                                {needsAssign &&
                                    <span className="sp-badge sp-badge--warn" style={{fontSize: "0.6rem"}}><i
                                        className="bx bx-user-plus" style={{marginRight: 3}}/>специалист</span>}
                            </div>
                        )}
                    </div>
                )
            })}
        </aside>
    )
}
