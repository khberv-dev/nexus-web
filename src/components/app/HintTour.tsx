"use client"

import {useCallback, useEffect, useMemo, useState} from "react"
import {createPortal} from "react-dom"

export type HintStep = {
    /** CSS-селектор подсвечиваемого элемента. Шаг пропускается, если элемента нет в DOM. */
    target: string
    title: string
    /** Короткое пояснение — одна-две строки, длинные тексты убивают смысл подсветки. */
    text: string
    /** Подготовка перед показом: переключить вкладку, раскрыть блок и т.п. */
    before?: () => void
}

type Rect = { top: number; left: number; width: number; height: number }

/** Отступ подсветки вокруг элемента. */
const PAD = 8
const CARD_WIDTH = 320
const CARD_GAP = 14
/** Пауза после before(): даём React отрисовать вкладку, прежде чем мерить элемент. */
const BEFORE_DELAY_MS = 220

function readRect(selector: string): Rect | null {
    if (typeof document === "undefined") return null
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return {top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2}
}

function seenKey(storageKey: string): string {
    return `nexus-hint-tour:${storageKey}`
}

export function hasSeenHintTour(storageKey: string): boolean {
    try {
        return window.localStorage.getItem(seenKey(storageKey)) === "1"
    } catch {
        return true // приватный режим/заблокированное хранилище — не навязываем подсказки
    }
}

export function markHintTourSeen(storageKey: string): void {
    try {
        window.localStorage.setItem(seenKey(storageKey), "1")
    } catch {
        /* хранилище недоступно — подсказка просто покажется снова */
    }
}

/** Сбросить отметку о просмотре (кнопка «Показать подсказки» в кабинете). */
export function resetHintTour(storageKey: string): void {
    try {
        window.localStorage.removeItem(seenKey(storageKey))
    } catch {
        /* ignore */
    }
}

/**
 * Слой-подсказка: затемняет и размывает всё, кроме объясняемого элемента.
 * Размытие даёт «дырка» из четырёх панелей вокруг цели — backdrop-filter не умеет
 * вырезать область, поэтому не размываем именно её, а окружение.
 */
export function HintTour({
                             steps,
                             storageKey,
                             enabled = true,
                             open,
                             onClose,
                         }: {
    steps: readonly HintStep[]
    /** Ключ в localStorage: обычно `${role}:v1:${email}`. */
    storageKey: string
    /** Автозапуск при первом визите. */
    enabled?: boolean
    /** Ручной запуск (кнопка «Подсказки»): переопределяет автозапуск. */
    open?: boolean
    onClose?: () => void
}) {
    const [mounted, setMounted] = useState(false)
    const [active, setActive] = useState(false)
    const [index, setIndex] = useState(0)
    const [rect, setRect] = useState<Rect | null>(null)

    useEffect(() => setMounted(true), [])

    // Автозапуск: только при первом визите и только если есть что показывать.
    useEffect(() => {
        if (!mounted || open !== undefined) return
        if (!enabled || steps.length === 0) return
        if (hasSeenHintTour(storageKey)) return
        setIndex(0)
        setActive(true)
    }, [mounted, enabled, steps.length, storageKey, open])

    useEffect(() => {
        if (open === undefined) return
        setActive(open)
        if (open) setIndex(0)
    }, [open])

    const step = active ? steps[index] : undefined

    const finish = useCallback(() => {
        setActive(false)
        setRect(null)
        markHintTourSeen(storageKey)
        onClose?.()
    }, [storageKey, onClose])

    const goTo = useCallback((next: number) => {
        if (next >= steps.length) {
            finish()
            return
        }
        setIndex(next)
    }, [steps.length, finish])

    // Измерение цели: после before(), с пересчётом на скролл/ресайз.
    useEffect(() => {
        if (!step) return
        let cancelled = false
        let raf = 0

        step.before?.()

        const measure = () => {
            if (cancelled) return
            const next = readRect(step.target)
            setRect(next)
        }

        const timer = window.setTimeout(() => {
            if (cancelled) return
            const el = document.querySelector(step.target)
            if (!el) {
                // Цели нет (вкладка пустая, блок не отрисован) — шаг пропускаем.
                goTo(index + 1)
                return
            }
            el.scrollIntoView({block: "center", behavior: "smooth"})
            raf = window.requestAnimationFrame(() => window.setTimeout(measure, 260))
        }, step.before ? BEFORE_DELAY_MS : 0)

        const onViewportChange = () => {
            window.cancelAnimationFrame(raf)
            raf = window.requestAnimationFrame(measure)
        }
        window.addEventListener("resize", onViewportChange)
        window.addEventListener("scroll", onViewportChange, true)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
            window.cancelAnimationFrame(raf)
            window.removeEventListener("resize", onViewportChange)
            window.removeEventListener("scroll", onViewportChange, true)
        }
    }, [step, index, goTo])

    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") finish()
            if (e.key === "ArrowRight" || e.key === "Enter") goTo(index + 1)
            if (e.key === "ArrowLeft" && index > 0) goTo(index - 1)
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [active, index, goTo, finish])

    const cardPosition = useMemo(() => {
        if (typeof window === "undefined") return {top: 0, left: 0}
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (!rect) {
            return {top: Math.max(24, vh / 2 - 90), left: Math.max(16, vw / 2 - CARD_WIDTH / 2)}
        }
        const below = rect.top + rect.height + CARD_GAP
        const fitsBelow = below + 180 < vh
        const top = fitsBelow ? below : Math.max(16, rect.top - 180 - CARD_GAP)
        const left = Math.min(Math.max(16, rect.left), vw - CARD_WIDTH - 16)
        return {top, left}
    }, [rect])

    if (!mounted || !active || !step) return null

    const dim = "rgba(10,10,18,0.55)"
    const blurPanel: React.CSSProperties = {
        position: "fixed",
        background: dim,
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        zIndex: 10000,
    }

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label={step.title}>
            {rect ? (
                <>
                    {/* Четыре панели вокруг цели: сама цель остаётся резкой и кликабельной. */}
                    <div style={{...blurPanel, top: 0, left: 0, right: 0, height: Math.max(0, rect.top)}}/>
                    <div style={{...blurPanel, top: rect.top + rect.height, left: 0, right: 0, bottom: 0}}/>
                    <div style={{...blurPanel, top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height}}/>
                    <div style={{...blurPanel, top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height}}/>
                    <div
                        style={{
                            position: "fixed",
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                            border: "2px solid rgba(139,124,246,0.9)",
                            borderRadius: 12,
                            boxShadow: "0 0 0 4px rgba(139,124,246,0.18)",
                            pointerEvents: "none",
                            zIndex: 10001,
                        }}
                    />
                </>
            ) : (
                <div style={{...blurPanel, inset: 0}}/>
            )}

            <div
                style={{
                    position: "fixed",
                    top: cardPosition.top,
                    left: cardPosition.left,
                    width: CARD_WIDTH,
                    maxWidth: "calc(100vw - 32px)",
                    zIndex: 10002,
                    borderRadius: 14,
                    border: "1px solid rgba(139,124,246,0.35)",
                    background: "hsl(247, 40%, 14%)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
                    padding: "14px 16px",
                    color: "#f4f4f4",
                    fontFamily: "inherit",
                }}
            >
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                    <i className="bx bx-info-circle" style={{color: "#a78bfa", fontSize: 16}}/>
                    <span style={{fontWeight: 600, fontSize: "0.9rem"}}>{step.title}</span>
                    <span style={{marginLeft: "auto", fontSize: "0.72rem", color: "rgba(255,255,255,0.45)"}}>
                        {index + 1}/{steps.length}
                    </span>
                </div>

                <p style={{margin: "0 0 12px", fontSize: "0.82rem", lineHeight: 1.5, color: "rgba(255,255,255,0.75)"}}>
                    {step.text}
                </p>

                <div style={{display: "flex", alignItems: "center", gap: 8}}>
                    <button
                        type="button"
                        onClick={finish}
                        style={{
                            border: "none",
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            fontSize: "0.78rem",
                            fontFamily: "inherit",
                            cursor: "pointer",
                            padding: 0,
                        }}
                    >
                        Пропустить
                    </button>
                    <div style={{marginLeft: "auto", display: "flex", gap: 8}}>
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => goTo(index - 1)}
                                style={{
                                    padding: "0.4em 0.9em",
                                    borderRadius: 999,
                                    border: "1px solid rgba(255,255,255,0.18)",
                                    background: "transparent",
                                    color: "rgba(255,255,255,0.75)",
                                    fontSize: "0.8rem",
                                    fontFamily: "inherit",
                                    cursor: "pointer",
                                }}
                            >
                                Назад
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => goTo(index + 1)}
                            style={{
                                padding: "0.4em 1.1em",
                                borderRadius: 999,
                                border: "1px solid rgba(139,124,246,0.5)",
                                background: "rgba(139,124,246,0.22)",
                                color: "#ddd6fe",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                fontFamily: "inherit",
                                cursor: "pointer",
                            }}
                        >
                            {index === steps.length - 1 ? "Понятно" : "Дальше"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    )
}

/** Плавающая кнопка «?» — вернуть подсказки после того, как их закрыли. */
export function HintTourLauncher({onClick, hidden}: { onClick: () => void; hidden?: boolean }) {
    if (hidden) return null
    return (
        <button
            type="button"
            onClick={onClick}
            title="Показать подсказки по кабинету"
            aria-label="Показать подсказки по кабинету"
            style={{
                position: "fixed",
                right: 20,
                bottom: 20,
                zIndex: 900,
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "1px solid rgba(139,124,246,0.45)",
                background: "rgba(139,124,246,0.16)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                color: "#ddd6fe",
                fontSize: "1.1rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
        >
            <i className="bx bx-help-circle"/>
        </button>
    )
}
