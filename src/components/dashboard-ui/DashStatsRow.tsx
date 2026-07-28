"use client"

import type { ReactNode } from "react"

type DashStatItem = {
  label: string
  value: ReactNode
  icon: string
  bg: string
  color: string
}

export function DashStatsRow({ items }: { items: DashStatItem[] }) {
  return (
    <div className="dash-stats-row">
      {items.map(s => (
        <div key={s.label} className="dash-stat-card">
          <div className="dash-stat-card__icon" style={{ background: s.bg, color: s.color }}>
            <i className={`bx ${s.icon}`} />
          </div>
          <div>
            <p className="dash-stat-card__value">{s.value}</p>
            <p className="dash-stat-card__label">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
