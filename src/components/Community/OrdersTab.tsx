"use client"

import React from "react"
import {DashEmptyState} from "@/components/dashboard-ui/DashEmptyState"
import {DashQuickLinks} from "@/components/dashboard-ui/DashQuickLinks"
import {DashListHeader} from "@/components/dashboard-ui/DashListHeader"
import {DashOrderCard} from "@/components/dashboard-ui/DashOrderCard"
import {DashSectionCard} from "@/components/dashboard-ui/DashSectionCard"
import {DashSignalListBlock} from "@/components/dashboard-ui/DashSignalListBlock"
import {DashStatsRow} from "@/components/dashboard-ui/DashStatsRow"
import type {StageType} from "@prisma/client"
import type {ActItem, OrderWithRelations, UrgentItem} from "./types"
import {DISCOVER_HUES, ORDER_HUE, ORDER_STATUS_MAP, STAGE_LABELS} from "./types"

const QUICK_LINKS = [
    {href: "/work/community?tab=portfolio", label: "Портфолио", sub: "Фото и рендеры", icon: "bx-image-alt"},
    {href: "/work/community?tab=payments", label: "Выплаты", sub: "История платежей", icon: "bx-credit-card"},
    {href: "/work/academy", label: "Академия", sub: "Обучение и гайды", icon: "bx-book-open"},
    {href: "/work/community?tab=settings", label: "Настройки", sub: "Профиль и данные", icon: "bx-cog"},
]

const STAGE_ORDER: StageType[] = ["CONCEPT", "PLANNING", "VISUALIZATION", "DOCUMENTATION", "SPECIFICATION"]
const STAGE_SHORT: Record<StageType, string> = {
    CONCEPT: "К",
    PLANNING: "П",
    VISUALIZATION: "В",
    DOCUMENTATION: "РД",
    SPECIFICATION: "С"
}
type StageState = "done" | "urgent" | "active" | "pending" | "none"

function getStageState(status: string | undefined): StageState {
    if (!status) return "none"
    if (status === "APPROVED") return "done"
    if (status === "MOD_REVISION" || status === "CLIENT_REVISION") return "urgent"
    if (["UPLOADED", "MOD_REVIEW", "CLIENT_REVIEW", "EXTRA_PAYMENT"].includes(status)) return "active"
    return "pending"
}

function StageProgress({stages}: { stages: OrderWithRelations["stages"] }) {
    const stageMap = Object.fromEntries(stages.map(s => [s.type, s.status]))
    return (
        <div className="dash-card__stages">
            {STAGE_ORDER.map((type, i) => {
                const state = getStageState(stageMap[type])
                return (
                    <React.Fragment key={type}>
                        {i > 0 && <div
                            className={`dash-card__stage-line dash-card__stage-line--${state === "none" ? "none" : stageMap[STAGE_ORDER[i - 1]] === "APPROVED" ? "done" : "none"}`}/>}
                        <div className={`dash-card__stage-dot dash-card__stage-dot--${state}`}
                             title={`${STAGE_LABELS[type]}: ${stageMap[type] ?? "не начат"}`}>
                            {state === "done" ? <i className="bx bx-check"/> : STAGE_SHORT[type]}
                        </div>
                    </React.Fragment>
                )
            })}
        </div>
    )
}

function ActsBlock({items, onSign}: { items: ActItem[]; onSign: (stageId: string) => void }) {
    if (items.length === 0) return null
    return (
        <DashSignalListBlock className="dash-acts" iconClass="bx-file-blank" title="Акты к подписанию"
                             count={items.length}>
            <ul className="dash-acts__list">
                {items.map(({order, stage}) => (
                    <li key={`${order.id}-${stage.type}`} className="dash-acts__item">
                        <div className="dash-acts__dot"/>
                        <div className="dash-acts__info">
                            <p className="dash-acts__title">{STAGE_LABELS[stage.type]}</p>
                            <p className="dash-acts__sub">Заказ #{order.id.slice(-6).toUpperCase()}</p>
                        </div>
                        <button className="dash-acts__action" data-tour="btn-sign-act" onClick={() => onSign(stage.id)}
                                style={{background: "none", border: "none", cursor: "pointer", fontFamily: "inherit"}}>
                            Подписать <i className="bx bx-pen"/>
                        </button>
                    </li>
                ))}
            </ul>
        </DashSignalListBlock>
    )
}

function UrgentBlock({items}: { items: UrgentItem[] }) {
    if (items.length === 0) return null
    const LABEL: Record<string, string> = {MOD_REVISION: "Замечания модератора", CLIENT_REVISION: "Замечания клиента"}
    return (
        <DashSignalListBlock className="dash-urgent" iconClass="bx-error-circle" title="Требует внимания"
                             count={items.length}>
            <ul className="dash-urgent__list">
                {items.map(({order, stage}) => (
                    <li key={`${order.id}-${stage.type}`} className="dash-urgent__item">
                        <div className="dash-urgent__dot"/>
                        <div className="dash-urgent__info">
                            <p className="dash-urgent__title">{STAGE_LABELS[stage.type]}</p>
                            <p className="dash-urgent__sub">Заказ
                                #{order.id.slice(-6).toUpperCase()} · {LABEL[stage.status] ?? stage.status}</p>
                        </div>
                        <a href={`/work/${order.id}`} className="dash-urgent__action">Загрузить <i
                            className="bx bx-upload"/></a>
                    </li>
                ))}
            </ul>
        </DashSignalListBlock>
    )
}

export function OrdersCol1({orders}: { orders: OrderWithRelations[] }) {
    return (
        <>
            <DashListHeader title="Последние проекты" action={<span className="dash-show-all">все</span>}/>
            {orders.length === 0 ? (
                <DashEmptyState iconClass="bx-folder-open" message="Проектов пока нет"/>
            ) : (
                <ul className="dash-list">
                    {orders.slice(0, 6).map(order => {
                        const hue = ORDER_HUE[order.status] ?? 247
                        const st = ORDER_STATUS_MAP[order.status] ?? {variant: "pending" as const, label: order.status}
                        return (
                            <li key={order.id} className="dash-list__item">
                                <div className="dash-list__thumb"
                                     style={{background: `linear-gradient(135deg, hsl(${hue},60%,58%), hsl(${hue + 35},60%,48%))`}}>
                                    {order.id.slice(-3).toUpperCase()}
                                </div>
                                <div className="dash-list__wrap">
                                    <p className="dash-list__content">Заказ #{order.id.slice(-6).toUpperCase()}</p>
                                    <p className="dash-list__sub">{(order.client?.email ?? "")} · {st.label}</p>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </>
    )
}

export function OrdersCol2({orders, urgentItems, actItems, onSignAct}: {
    orders: OrderWithRelations[]; urgentItems: UrgentItem[]; actItems: ActItem[]; onSignAct: (stageId: string) => void
}) {
    const activeOrders = orders.filter(o => o.status !== "CANCELLED").slice(0, 3)
    return (
        <>
            <UrgentBlock items={urgentItems}/>
            <ActsBlock items={actItems} onSign={onSignAct}/>

            <DashStatsRow
                items={[
                    {
                        label: "Всего проектов",
                        value: orders.length,
                        icon: "bx-folder",
                        bg: "var(--dash-accent-bg)",
                        color: "var(--dash-accent)"
                    },
                    {
                        label: "Завершено",
                        value: orders.filter(o => o.status === "DONE").length,
                        icon: "bx-check-circle",
                        bg: "var(--dash-success-bg)",
                        color: "var(--dash-success)"
                    },
                    {
                        label: "В работе",
                        value: orders.filter(o => o.status === "ACTIVE").length,
                        icon: "bx-time-five",
                        bg: "var(--dash-warn-bg)",
                        color: "var(--dash-warn)"
                    },
                ]}
            />

            <DashSectionCard title="Активные заказы">
                <ul className="dash-cards">
                    {activeOrders.length === 0 ? (
                        <li className="dash-card dash-card--placeholder">
                            <div className="dash-card__body"><h3 className="dash-card__heading">Нет проектов</h3></div>
                        </li>
                    ) : activeOrders.map(order => {
                        const hue = ORDER_HUE[order.status] ?? 247
                        const st = ORDER_STATUS_MAP[order.status] ?? {variant: "pending" as const, label: order.status}
                        const statusStripClass =
                            order.status === "DONE"
                                ? "dash-card--state-done"
                                : order.status === "DRAFT"
                                    ? "dash-card--state-draft"
                                    : order.status === "ACTIVE" || order.status === "BRIEFING" || order.status === "BRIEF_REVIEW"
                                        ? "dash-card--state-active"
                                        : "dash-card--state-neutral"
                        return (
                            <DashOrderCard
                                key={order.id}
                                className={`dash-card--lk-order ${statusStripClass}`}
                                hue={hue}
                                watermark={`#${order.id.slice(-4).toUpperCase()}`}
                                title={`Заказ #${order.id.slice(-6).toUpperCase()}`}
                                subtitle={order.client.name ?? order.client.email}
                                hideSpecialistInfo
                                onClick={() => window.location.href = `/work/${order.id}`}
                                statusLabel={st.label}
                                statusVariant={st.variant}
                            >
                                <StageProgress stages={order.stages}/>
                            </DashOrderCard>
                        )
                    })}
                </ul>
            </DashSectionCard>

            <DashQuickLinks
                title="Быстрый доступ"
                items={QUICK_LINKS.map((link, i) => ({
                    ...link,
                    h1: DISCOVER_HUES[i % DISCOVER_HUES.length].h1,
                    h2: DISCOVER_HUES[i % DISCOVER_HUES.length].h2,
                }))}
            />
        </>
    )
}
