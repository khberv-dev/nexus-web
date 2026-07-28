"use client"

import { useEffect, useRef, useState } from "react"
import { DashOrderCard } from "@/components/dashboard-ui/DashOrderCard"
import { DashSectionCard } from "@/components/dashboard-ui/DashSectionCard"
import { DashActionLink } from "@/components/dashboard-ui/DashActionLink"
import { ORDER_HUE, ORDER_STATUS_MAP } from "./constants"
import { DeleteButton, HelpButton } from "./OrderListActions"
import {
  formatOrderObjectType,
  formatOrderSum,
  orderStageSummary,
} from "./order-filter"
import type { ClientOrder, ClientPayment } from "./types"

function OrderCardActionsMenu({
  order,
  brief,
  isDraft,
  alreadyRequested,
  onHelpRequested,
}: {
  order: ClientOrder
  brief: Record<string, unknown> | null
  isDraft: boolean
  alreadyRequested: boolean
  onHelpRequested: (orderId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div
      className="dash-order-card-actions-menu"
      ref={menuRef}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <button
        type="button"
        className="dash-order-card-actions-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <i className="bx bx-dots-horizontal-rounded" />
        Действия
      </button>
      {open && (
        <div className="dash-order-card-actions-menu__popup" role="menu">
          {isDraft ? (
            <DashActionLink
              href="/orders/new"
              className="dash-order-card-actions-menu__item"
            >
              Продолжить заполнение
            </DashActionLink>
          ) : (
            <DashActionLink href={`/orders/${order.id}`} className="dash-order-card-actions-menu__item">
              Открыть заказ
            </DashActionLink>
          )}
          {(order.status === "DRAFT" || order.status === "BRIEFING") && (
            <HelpButton
              orderId={order.id}
              briefData={(brief ?? {}) as Record<string, string>}
              alreadyRequested={alreadyRequested}
              onRequested={() => onHelpRequested(order.id)}
              className="dash-order-card-actions-menu__item dash-order-card-actions-menu__item--btn"
            />
          )}
          {isDraft && (
            <DeleteButton
              orderId={order.id}
              className="dash-order-card-actions-menu__item dash-order-card-actions-menu__item--btn dash-order-card-actions-menu__item--danger"
            />
          )}
        </div>
      )}
    </div>
  )
}

export function OrdersSidebar({
  orders,
  payments,
}: {
  orders: ClientOrder[]
  payments: ClientPayment[]
}) {
  const [scrollStateBySection, setScrollStateBySection] = useState<Record<string, { canLeft: boolean; canRight: boolean }>>({})
  const [helpRequestedIds, setHelpRequestedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const init = Object.fromEntries(orders.filter(o => o.briefHelpRequested).map(o => [o.id, true]))
    setHelpRequestedIds(init)
  }, [orders])

  const updateScrollState = (sectionKey: string, el: HTMLUListElement | null) => {
    if (!el) return
    const canLeft = el.scrollLeft > 4
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setScrollStateBySection(prev => {
      const cur = prev[sectionKey]
      if (cur && cur.canLeft === canLeft && cur.canRight === canRight) return prev
      return { ...prev, [sectionKey]: { canLeft, canRight } }
    })
  }

  const scrollSection = (sectionKey: string, direction: "left" | "right") => {
    const el = document.querySelector<HTMLUListElement>(`[data-orders-section="${sectionKey}"]`)
    if (!el) return
    const delta = Math.round(el.clientWidth * 0.72)
    el.scrollBy({ left: direction === "left" ? -delta : delta, behavior: "smooth" })
  }

  const totalPaid = payments.filter(p => p.status === "RELEASED").reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)

  const activeOrders = orders
    .filter(o => o.status === "ACTIVE" || o.status === "BRIEFING" || o.status === "BRIEF_REVIEW")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const draftOrders = orders
    .filter(o => o.status === "DRAFT")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const doneOrders = orders
    .filter(o => o.status === "DONE")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const renderSection = (title: string, sectionOrders: ClientOrder[]) => {
    if (sectionOrders.length === 0) return null
    const sectionKey = title.toLowerCase().replace(/\s+/g, "-")
    const scrollState = scrollStateBySection[sectionKey] ?? { canLeft: false, canRight: false }
    return (
      <DashSectionCard title={title} className="dash-cards-container--lk-strip" style={{ marginTop: 18 }}>
        <div className="dash-cards-scroll-wrap">
          {scrollState.canLeft && (
            <button
              type="button"
              className="dash-cards-scroll-btn dash-cards-scroll-btn--left"
              onClick={() => scrollSection(sectionKey, "left")}
              aria-label="Прокрутить карточки влево"
            >
              <i className="bx bx-chevron-left" />
            </button>
          )}
          {scrollState.canRight && (
            <button
              type="button"
              className="dash-cards-scroll-btn dash-cards-scroll-btn--right"
              onClick={() => scrollSection(sectionKey, "right")}
              aria-label="Прокрутить карточки вправо"
            >
              <i className="bx bx-chevron-right" />
            </button>
          )}
          <ul
            className="dash-cards"
            data-orders-section={sectionKey}
            ref={el => updateScrollState(sectionKey, el)}
            onScroll={e => updateScrollState(sectionKey, e.currentTarget)}
          >
            {sectionOrders.map(order => {
              const hue = ORDER_HUE[order.status] ?? 247
              const st = ORDER_STATUS_MAP[order.status] ?? { variant: "pending" as const, label: order.status }
              const brief = order.briefData as Record<string, unknown> | null
              const isDraft = order.status === "DRAFT"
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
                  subtitle={order.specialist ? order.specialist.name ?? "Дизайнер назначен" : "Ожидает специалиста"}
                  specialistName={order.specialist?.name ?? null}
                  specialistAvatarUrl={order.specialist?.avatarUrl ?? null}
                  hideSpecialistInfo={isDraft}
                  onClick={() => {
                    if (order.status === "DRAFT") {
                      window.location.href = "/orders/new"
                    } else {
                      window.location.href = `/orders/${order.id}`
                    }
                  }}
                  metaRows={[
                    { label: "Тип объекта", value: formatOrderObjectType(brief) },
                    { label: "Сумма", value: formatOrderSum(order) },
                    { label: "Стадия", value: orderStageSummary(order) },
                  ]}
                  helpBadge={
                    order.briefHelpRequested || helpRequestedIds[order.id] ? (
                      <span className="dash-card__icon-badge dash-card__icon-badge--help" title="Помощь менеджера: запрос отправлен" aria-label="Помощь менеджера: запрос отправлен">
                        <i className="bx bx-support" />
                      </span>
                    ) : undefined
                  }
                  statusLabel={st.label}
                  statusVariant={st.variant}
                >
                  <OrderCardActionsMenu
                    order={order}
                    brief={brief}
                    isDraft={isDraft}
                    alreadyRequested={Boolean(order.briefHelpRequested || helpRequestedIds[order.id])}
                    onHelpRequested={orderId => setHelpRequestedIds(prev => ({ ...prev, [orderId]: true }))}
                  />
                </DashOrderCard>
              )
            })}
          </ul>
        </div>
      </DashSectionCard>
    )
  }

  return (
    <>
      {(totalPaid > 0 || totalPending > 0) && (
        <div className="dash-payment-chips">
          {totalPaid > 0 && (
            <div className="dash-payment-chip">
              <span className="dash-payment-chip--muted">Оплачено </span>
              <strong>{(totalPaid / 100).toLocaleString("ru-RU")} руб.</strong>
            </div>
          )}
          {totalPending > 0 && (
            <div className="dash-payment-chip">
              <span className="dash-payment-chip--muted">К оплате </span>
              <strong>{(totalPending / 100).toLocaleString("ru-RU")} руб.</strong>
            </div>
          )}
        </div>
      )}

      <div className="dash-order-icons-legend" aria-label="Расшифровка иконок карточки заказа">
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--status dash-card__icon-badge--status-pending">
            <i className="bx bx-edit-alt" />
          </span>
          <span>Черновик / ожидание</span>
        </span>
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--status dash-card__icon-badge--status-current">
            <i className="bx bx-loader-circle" />
          </span>
          <span>На проверке</span>
        </span>
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--status dash-card__icon-badge--status-active">
            <i className="bx bx-time-five" />
          </span>
          <span>В работе</span>
        </span>
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--status dash-card__icon-badge--status-done">
            <i className="bx bx-check-circle" />
          </span>
          <span>Завершен</span>
        </span>
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--status dash-card__icon-badge--status-rejected">
            <i className="bx bx-x-circle" />
          </span>
          <span>Отменен</span>
        </span>
        <span className="dash-order-icons-legend__item">
          <span className="dash-card__icon-badge dash-card__icon-badge--help">
            <i className="bx bx-support" />
          </span>
          <span>Запрос помощи менеджера</span>
        </span>
      </div>

      {renderSection("Активные заказы", activeOrders)}
      {renderSection("Черновики", draftOrders)}
      {renderSection("Завершенные", doneOrders)}
    </>
  )
}
