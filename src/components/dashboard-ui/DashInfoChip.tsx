import type { ReactNode } from "react"

export function DashInfoChip({
  dot,
  label,
  value,
}: {
  dot: ReactNode
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div className="dash-order-chip">
      <span className="dash-order-chip__dot">{dot}</span>
      <div className="dash-order-chip__meta">
        <span className="dash-order-chip__label">{label}</span>
        <span className="dash-order-chip__value">{value}</span>
      </div>
    </div>
  )
}
