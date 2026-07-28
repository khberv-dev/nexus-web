"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

export function DashCarousel({
  children,
  ariaLabel = "Карусель",
  className = "",
  viewportClassName = "",
}: {
  children: ReactNode
  ariaLabel?: string
  className?: string
  viewportClassName?: string
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startLeft: 0, moved: false })
  const suppressClickRef = useRef(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateScrollState = () => {
    const el = viewportRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateScrollState()
    const onResize = () => updateScrollState()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const scroll = (dir: "left" | "right") => {
    const el = viewportRef.current
    if (!el) return
    const delta = Math.round(el.clientWidth * 0.72)
    el.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current
    if (!el) return
    const target = e.target as HTMLElement | null
    // Don't start drag when clicking interactive elements.
    if (target?.closest("button, a, input, select, textarea, [role='button'], [data-carousel-clickable='true']")) return
    dragRef.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current
    if (!el || !dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) > 14) dragRef.current.moved = true
    el.scrollLeft = dragRef.current.startLeft - dx
    updateScrollState()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current
    if (!el) return
    const moved = dragRef.current.moved
    const traveled = Math.abs(el.scrollLeft - dragRef.current.startLeft)
    dragRef.current.active = false
    dragRef.current.moved = false
    try { el.releasePointerCapture(e.pointerId) } catch {}
    if (moved && traveled > 18) {
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 120)
    }
    updateScrollState()
  }

  return (
    <div className={`dash-carousel ${className}`}>
      {canLeft && (
        <button type="button" className="dash-carousel__nav dash-carousel__nav--left" onClick={() => scroll("left")} aria-label="Прокрутить влево">
          <i className="bx bx-chevron-left" />
        </button>
      )}
      <div
        ref={viewportRef}
        className={`dash-carousel__viewport ${viewportClassName}`.trim()}
        aria-label={ariaLabel}
        onScroll={updateScrollState}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={e => {
          if (suppressClickRef.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {children}
      </div>
      {canRight && (
        <button type="button" className="dash-carousel__nav dash-carousel__nav--right" onClick={() => scroll("right")} aria-label="Прокрутить вправо">
          <i className="bx bx-chevron-right" />
        </button>
      )}
    </div>
  )
}
