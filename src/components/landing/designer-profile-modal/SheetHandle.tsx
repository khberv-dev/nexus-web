"use client"

import type { PointerEvent } from "react"

interface SheetHandleProps {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void
}

export function SheetHandle({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: SheetHandleProps) {
  return (
    <button
      type="button"
      aria-label="Потянуть панель профиля"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        width: "100%",
        padding: "10px 0 8px",
        margin: 0,
        border: "none",
        background: "transparent",
        cursor: "grab",
        touchAction: "none",
        display: "block",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 44,
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.35)",
          margin: "0 auto",
        }}
      />
    </button>
  )
}
