"use client"

import { StatusBadge } from "@/components/app/AppCard"
import { DashActionLink } from "@/components/dashboard-ui/DashActionLink"
import { DashEmptyState } from "@/components/dashboard-ui/DashEmptyState"
import {
  BRIEF_WIZARD_STEP_COUNT,
  briefListProgressWidthPercent,
  countFilledBriefFields,
  formatDraftBriefPreviewLine,
} from "@/lib/clientBriefDisplay"
import { ORDER_HUE, ORDER_STATUS_MAP } from "./constants"
import { FILTER_EMPTY_HINT, type OrderListFilter } from "./order-filter"
import type { ClientOrder } from "./types"
import { DeleteButton, HelpButton } from "./OrderListActions"

export function OrdersListView({
  orders,
  listFilter,
}: {
  orders: ClientOrder[]
  listFilter: OrderListFilter
}) {
  if (orders.length === 0) {
    return (
      <DashEmptyState iconClass="bx-folder-open" message={FILTER_EMPTY_HINT[listFilter]}>
        <DashActionLink href="/orders/new" iconClass="bx-plus" className="dash-action-link--sm">
          Создать заказ
        </DashActionLink>
      </DashEmptyState>
    )
  }

  const listClass = `dash-list${listFilter === "all" ? " dash-list--compact-thumb" : ""}`

  return (
    <ul className={listClass}>
      {orders.map(order => {
        const hue = ORDER_HUE[order.status] ?? 247
        const st = ORDER_STATUS_MAP[order.status] ?? { variant: "pending" as const, label: order.status }
        const brief = order.briefData as Record<string, unknown> | null
        const abbr = order.id.slice(-3).toUpperCase()
        const hasClientReview = order.stages.some(s => s.status === "CLIENT_REVIEW")
        const isDraft = order.status === "DRAFT"
        const briefFields = countFilledBriefFields(brief)
        const draftPreview = formatDraftBriefPreviewLine(brief)
        const briefBarPct = briefListProgressWidthPercent(briefFields)

        return (
          <li key={order.id} className="dash-list__item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div className="dash-list__head-row">
              <div
                className="dash-list__thumb"
                style={{ background: `linear-gradient(135deg, hsl(${hue},60%,58%), hsl(${hue + 35},60%,48%))` }}
              >
                {abbr}
              </div>
              <div className="dash-list__wrap" style={{ flex: 1 }}>
                <p className="dash-list__content dash-list__content--badges">
                  Заказ #{order.id.slice(-6).toUpperCase()}
                  <StatusBadge variant={st.variant} label={st.label} />
                  {order.briefHelpRequested && (
                    <span className="dash-list__help-badge" title="Запрос на помощь менеджера уже отправлен">
                      <i className="bx bx-check-shield" />
                      Запрос менеджеру отправлен
                    </span>
                  )}
                </p>
                <p className="dash-list__sub">
                  {hasClientReview && (
                    <>
                      <i className="bx bx-bell" style={{ color: "var(--dash-warn)" }} /> Решение ·{" "}
                    </>
                  )}
                  {draftPreview}
                  {order.specialist && <> · {order.specialist.name ?? "Дизайнер"}</>}
                  {" · "}
                  {new Date(order.updatedAt).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>

            {isDraft && (
              <div
                className="dash-list__indent"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <DashActionLink
                    href="/orders/new"
                    className="dash-action-link--xs"
                  >
                    Заполнить бриф
                  </DashActionLink>
                  <HelpButton
                    orderId={order.id}
                    briefData={(brief ?? {}) as Record<string, string>}
                    alreadyRequested={order.briefHelpRequested}
                  />
                </div>
                <DeleteButton orderId={order.id} />
              </div>
            )}
            {!isDraft && (
              <div className="dash-list__indent">
                <DashActionLink href={`/orders/${order.id}`} className="dash-action-link--sm">
                  Открыть →
                </DashActionLink>
              </div>
            )}

            {isDraft && (
              <div className="dash-list__indent">
                <div style={{ fontSize: "0.72rem", color: "var(--dash-muted)", marginBottom: 4 }}>
                  Бриф: шаг {Math.min(order.briefStep + 1, BRIEF_WIZARD_STEP_COUNT)}/{BRIEF_WIZARD_STEP_COUNT} · {briefFields} полей
                </div>
                <div style={{ height: 3, background: "var(--dash-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${briefBarPct}%`,
                      background: "var(--dash-warn)",
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            )}

            {order.status === "ACTIVE" &&
              (() => {
                const approved = order.stages.filter(s => s.status === "APPROVED").length
                const total = order.stages.length || 3
                const pct = Math.round((approved / total) * 100)
                return (
                  <div className="dash-list__indent">
                    <div style={{ fontSize: "0.72rem", color: "var(--dash-muted)", marginBottom: 4 }}>
                      Прогресс: {approved}/{total} этапов
                    </div>
                    <div style={{ height: 3, background: "var(--dash-border)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: pct === 100 ? "var(--dash-success)" : "var(--dash-accent)",
                          borderRadius: 3,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                )
              })()}
          </li>
        )
      })}
    </ul>
  )
}
