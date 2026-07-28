"use client"

import { useEffect, useRef, useState, type PointerEvent } from "react"

export function useProfileSheet(enabled: boolean, resetKey: string) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ active: false, startY: 0, startOffset: 0 })
  const [sheetOffset, setSheetOffset] = useState(0)
  const [sheetMaxOffset, setSheetMaxOffset] = useState(0)
  const [sheetDragActive, setSheetDragActive] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setSheetOffset(0)
  }, [enabled, resetKey])

  useEffect(() => {
    if (!enabled) return
    const el = sheetRef.current
    if (!el) return
    const peek = 64

    const compute = () => {
      const h = el.getBoundingClientRect().height
      const max = Math.max(0, Math.round(h - peek))
      setSheetMaxOffset(max)
      setSheetOffset((prev) => Math.min(Math.max(prev, 0), max))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled])

  const snapSheet = (target: "open" | "collapsed") => {
    setSheetOffset(target === "open" ? 0 : sheetMaxOffset)
  }

  const onSheetPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!enabled) return
    setSheetDragActive(true)
    dragRef.current = { active: true, startY: e.clientY, startOffset: sheetOffset }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch { /* noop */ }
  }

  const onSheetPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || !dragRef.current.active) return
    const dy = e.clientY - dragRef.current.startY
    const next = dragRef.current.startOffset + dy
    setSheetOffset(Math.min(Math.max(next, 0), sheetMaxOffset))
  }

  const endSheetDrag = (e: PointerEvent<HTMLButtonElement>, offsetAtEnd: number) => {
    if (!enabled) return
    const traveled = offsetAtEnd - dragRef.current.startOffset
    dragRef.current.active = false
    setSheetDragActive(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* noop */ }
    const threshold = Math.min(120, sheetMaxOffset * 0.22)
    if (traveled > threshold) snapSheet("collapsed")
    else if (traveled < -threshold) snapSheet("open")
    else snapSheet(offsetAtEnd > sheetMaxOffset / 2 ? "collapsed" : "open")
  }

  const onSheetPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || !dragRef.current.active) return
    const dy = e.clientY - dragRef.current.startY
    const offsetAtEnd = Math.min(Math.max(dragRef.current.startOffset + dy, 0), sheetMaxOffset)
    endSheetDrag(e, offsetAtEnd)
  }

  const onSheetPointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || !dragRef.current.active) return
    dragRef.current.active = false
    setSheetDragActive(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* noop */ }
  }

  return {
    sheetRef,
    sheetOffset,
    sheetDragActive,
    sheetHandlers: {
      onPointerDown: onSheetPointerDown,
      onPointerMove: onSheetPointerMove,
      onPointerUp: onSheetPointerUp,
      onPointerCancel: onSheetPointerCancel,
    },
  }
}
