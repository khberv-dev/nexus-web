import type { ReactNode } from "react"
import { DashProjectCard } from "./DashProjectCard"

export function DashOrderCard({
  hue,
  watermark,
  title,
  subtitle,
  onClick,
  helpBadge,
  metaRows,
  statusLabel,
  statusVariant,
  specialistName,
  specialistAvatarUrl,
  hideSpecialistInfo = false,
  children,
  className = "",
}: {
  hue: number
  watermark: string
  title: string
  subtitle?: ReactNode
  onClick?: () => void
  helpBadge?: ReactNode
  metaRows?: { label: string; value: ReactNode }[]
  statusLabel?: string
  statusVariant?: "active" | "pending" | "done" | "rejected" | "current"
  specialistName?: string | null
  specialistAvatarUrl?: string | null
  hideSpecialistInfo?: boolean
  children?: ReactNode
  className?: string
}) {
  const STATUS_ICON_BY_VARIANT: Record<NonNullable<typeof statusVariant>, string> = {
    pending: "bx-edit-alt",
    current: "bx-loader-circle",
    active: "bx-time-five",
    done: "bx-check-circle",
    rejected: "bx-x-circle",
  }

  const initials = specialistName
    ? specialistName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? "")
        .join("")
    : ""

  const designerLabel =
    specialistName ?? (typeof subtitle === "string" && subtitle.trim() ? subtitle : "Ожидает специалиста")

  return (
    <DashProjectCard
      hue={hue}
      watermark={watermark}
      title=""
      subtitle=""
      onClick={onClick}
      className={className}
    >
      <div className="dash-order-card__header">
        <div className="dash-order-card__order">{title}</div>
        <div className={`dash-order-card__designer${hideSpecialistInfo ? " is-hidden" : ""}`}>
          <span className="dash-card__specialist-avatar" title={designerLabel}>
            {specialistAvatarUrl ? (
              <img src={specialistAvatarUrl} alt={designerLabel} className="dash-card__specialist-avatar-img" />
            ) : (
              <span className="dash-card__specialist-avatar-fallback">{initials || "D"}</span>
            )}
          </span>
          <span className="dash-order-card__designer-name">{designerLabel}</span>
        </div>
      </div>
      {metaRows && metaRows.length > 0 ? (
        <div className="dash-active-order-meta" role="list">
          {metaRows.map(row => (
            <div key={row.label} className="dash-active-order-meta__row" role="listitem">
              <span className="dash-active-order-meta__label">{row.label}:</span>
              <span className="dash-active-order-meta__val">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="dash-order-card__footer">
        <div className="dash-card__badges-row">
          {statusLabel ? (
            <span
              className={`dash-card__icon-badge dash-card__icon-badge--status${statusVariant ? ` dash-card__icon-badge--status-${statusVariant}` : ""}`}
              title={`Статус: ${statusLabel}`}
              aria-label={`Статус: ${statusLabel}`}
            >
              <i className={`bx ${STATUS_ICON_BY_VARIANT[statusVariant ?? "pending"]}`} />
            </span>
          ) : null}
          {helpBadge}
        </div>
        <div className="dash-order-card__footer-actions">{children}</div>
      </div>
    </DashProjectCard>
  )
}
