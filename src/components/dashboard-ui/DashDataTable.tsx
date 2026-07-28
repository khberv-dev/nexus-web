"use client"

import type { ReactNode } from "react"

type Column = {
  label: string
  align?: "left" | "right" | "center"
}

export function DashDataTable({
  columns,
  children,
}: {
  columns: Column[]
  children: ReactNode
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
      <thead>
        <tr
          style={{
            borderBottom: "1px solid var(--dash-border)",
            color: "var(--dash-muted)",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {columns.map(col => (
            <th
              key={col.label}
              style={{
                textAlign: col.align ?? "left",
                padding: "6px 0",
                fontWeight: 600,
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
