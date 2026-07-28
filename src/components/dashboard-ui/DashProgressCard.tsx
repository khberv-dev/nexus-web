import type { ReactNode } from "react"

export function DashProgressCard({
  title = "Прогресс",
  current,
  total,
  className = "",
}: {
  title?: ReactNode
  current: number
  total: number
  className?: string
}) {
  const safeTotal = total > 0 ? total : 1
  const pct = Math.round((current / safeTotal) * 100)
  const done = pct >= 100

  return (
    <div className={`dash-progress-card ${className}`.trim()}>
      <div className="dash-progress-head">
        <span className="dash-progress-title">{title}</span>
        <span className="dash-progress-count" style={{ color: done ? "var(--dash-success)" : "var(--dash-muted)" }}>
          {current}/{total}
        </span>
      </div>
      <div className="dash-progress-track dash-progress-track--top">
        <div className="dash-progress-fill" style={{ background: done ? "var(--dash-success)" : "var(--dash-accent)", width: `${pct}%` }} />
      </div>
    </div>
  )
}
