"use client"

import {useEffect, useMemo, useRef, useState} from "react"
import {formatMultiValue, parseMultiValue, toggleMultiValue} from "@/lib/specialist-options"

type Palette = {
    controlBg: string
    panelBg: string
    border: string
    borderStrong: string
    text: string
    muted: string
    chipBg: string
    chipBorder: string
    chipText: string
    hoverBg: string
    shadow: string
}

const PALETTES: Record<"dark" | "surface", Palette> = {
    // Онбординг — тёмная карточка на градиентном фоне
    dark: {
        controlBg: "rgba(255,255,255,0.05)",
        panelBg: "#1b1c26",
        border: "rgba(255,255,255,0.1)",
        borderStrong: "rgba(255,255,255,0.35)",
        text: "#f4f4f4",
        muted: "rgba(255,255,255,0.45)",
        chipBg: "rgba(121,40,202,0.3)",
        chipBorder: "rgba(121,40,202,0.55)",
        chipText: "#e0d0ff",
        hoverBg: "rgba(255,255,255,0.06)",
        shadow: "0 12px 32px rgba(0,0,0,0.45)",
    },
    // Кабинет специалиста и админка — палитра --dash-*
    surface: {
        controlBg: "var(--dash-surface2)",
        panelBg: "var(--dash-surface2)",
        border: "var(--dash-border)",
        borderStrong: "var(--dash-accent)",
        text: "var(--dash-text)",
        muted: "var(--dash-muted)",
        chipBg: "var(--dash-accent-bg, rgba(99,102,241,0.12))",
        chipBorder: "var(--dash-accent)",
        chipText: "var(--dash-accent)",
        hoverBg: "var(--dash-surface, rgba(127,127,127,0.08))",
        shadow: "0 12px 32px rgba(0,0,0,0.25)",
    },
}

/**
 * Мультиселект по справочнику с возможностью добавить своё значение.
 * Наружу отдаёт ту же строку "значение, значение", что и раньше хранилась в formData.
 */
export function MultiSelectField({
                                     value,
                                     onChange,
                                     options,
                                     placeholder = "Выберите из списка…",
                                     searchPlaceholder = "Поиск или своё значение…",
                                     variant = "surface",
                                     allowCustom = true,
                                     disabled = false,
                                 }: {
    value: string
    onChange: (value: string) => void
    options: readonly string[]
    placeholder?: string
    searchPlaceholder?: string
    variant?: "dark" | "surface"
    allowCustom?: boolean
    disabled?: boolean
}) {
    const p = PALETTES[variant]
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const wrapRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const selected = useMemo(() => parseMultiValue(value), [value])
    const selectedKeys = useMemo(() => new Set(selected.map((v) => v.toLowerCase())), [selected])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter((o) => o.toLowerCase().includes(q))
    }, [options, query])

    // Значения, которых нет в справочнике (введены вручную или сохранены до мультиселекта).
    const customSelected = useMemo(
        () => selected.filter((v) => !options.some((o) => o.toLowerCase() === v.toLowerCase())),
        [selected, options],
    )

    const trimmedQuery = query.trim()
    const canAddCustom =
        allowCustom &&
        trimmedQuery.length > 0 &&
        !options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase()) &&
        !selectedKeys.has(trimmedQuery.toLowerCase())

    useEffect(() => {
        if (!open) return
        const onDocClick = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDocClick)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDocClick)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    useEffect(() => {
        if (open) searchRef.current?.focus()
        else setQuery("")
    }, [open])

    const toggle = (option: string) => onChange(toggleMultiValue(value, option))
    const addCustom = () => {
        if (!canAddCustom) return
        onChange(formatMultiValue([...selected, trimmedQuery]))
        setQuery("")
    }

    return (
        <div ref={wrapRef} style={{position: "relative"}}>
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-expanded={open}
                onClick={() => !disabled && setOpen((v) => !v)}
                onKeyDown={(e) => {
                    if (disabled) return
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setOpen((v) => !v)
                    }
                }}
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 42,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.45em 2em 0.45em 0.75em",
                    borderRadius: 8,
                    border: `1px solid ${open ? p.borderStrong : p.border}`,
                    background: p.controlBg,
                    color: p.text,
                    fontSize: "0.85rem",
                    fontFamily: "inherit",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                {selected.length === 0 && <span style={{color: p.muted}}>{placeholder}</span>}
                {selected.map((v) => (
                    <span
                        key={v}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "0.2em 0.6em",
                            borderRadius: 100,
                            fontSize: "0.75rem",
                            background: p.chipBg,
                            border: `1px solid ${p.chipBorder}`,
                            color: p.chipText,
                        }}
                    >
                        {v}
                        <button
                            type="button"
                            aria-label={`Убрать ${v}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (!disabled) toggle(v)
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                fontSize: "0.85rem",
                                lineHeight: 1,
                                padding: 0,
                            }}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <i
                    className={`bx ${open ? "bx-chevron-up" : "bx-chevron-down"}`}
                    style={{position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: p.muted}}
                />
            </div>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        zIndex: 40,
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        borderRadius: 8,
                        border: `1px solid ${p.border}`,
                        background: p.panelBg,
                        boxShadow: p.shadow,
                        overflow: "hidden",
                    }}
                >
                    <div style={{padding: 8, borderBottom: `1px solid ${p.border}`}}>
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            placeholder={searchPlaceholder}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    addCustom()
                                }
                            }}
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "0.45em 0.7em",
                                borderRadius: 6,
                                border: `1px solid ${p.border}`,
                                background: p.controlBg,
                                color: p.text,
                                fontSize: "0.82rem",
                                fontFamily: "inherit",
                                outline: "none",
                            }}
                        />
                    </div>

                    <div style={{maxHeight: 240, overflowY: "auto", padding: 4}}>
                        {filtered.length === 0 && !canAddCustom && (
                            <div style={{padding: "0.6em 0.7em", fontSize: "0.8rem", color: p.muted}}>
                                Ничего не найдено
                            </div>
                        )}
                        {filtered.map((option) => {
                            const on = selectedKeys.has(option.toLowerCase())
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggle(option)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "0.45em 0.7em",
                                        borderRadius: 6,
                                        border: "none",
                                        background: on ? p.chipBg : "transparent",
                                        color: on ? p.chipText : p.text,
                                        fontSize: "0.82rem",
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!on) e.currentTarget.style.background = p.hoverBg
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!on) e.currentTarget.style.background = "transparent"
                                    }}
                                >
                                    <span
                                        aria-hidden
                                        style={{
                                            width: 15,
                                            height: 15,
                                            flexShrink: 0,
                                            borderRadius: 4,
                                            border: `1.5px solid ${on ? p.chipBorder : p.border}`,
                                            background: on ? p.chipBorder : "transparent",
                                            color: variant === "dark" ? "#fff" : "#fff",
                                            fontSize: "0.65rem",
                                            lineHeight: "13px",
                                            textAlign: "center",
                                        }}
                                    >
                                        {on ? "✓" : ""}
                                    </span>
                                    {option}
                                </button>
                            )
                        })}

                        {customSelected
                            .filter((v) => !query.trim() || v.toLowerCase().includes(query.trim().toLowerCase()))
                            .map((v) => (
                                <button
                                    key={`custom-${v}`}
                                    type="button"
                                    onClick={() => toggle(v)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "0.45em 0.7em",
                                        borderRadius: 6,
                                        border: "none",
                                        background: p.chipBg,
                                        color: p.chipText,
                                        fontSize: "0.82rem",
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        aria-hidden
                                        style={{
                                            width: 15,
                                            height: 15,
                                            flexShrink: 0,
                                            borderRadius: 4,
                                            border: `1.5px solid ${p.chipBorder}`,
                                            background: p.chipBorder,
                                            color: "#fff",
                                            fontSize: "0.65rem",
                                            lineHeight: "13px",
                                            textAlign: "center",
                                        }}
                                    >
                                        ✓
                                    </span>
                                    {v}
                                    <span style={{marginLeft: "auto", fontSize: "0.7rem", color: p.muted}}>своё</span>
                                </button>
                            ))}

                        {canAddCustom && (
                            <button
                                type="button"
                                onClick={addCustom}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "0.45em 0.7em",
                                    borderRadius: 6,
                                    border: `1px dashed ${p.border}`,
                                    background: "transparent",
                                    color: p.muted,
                                    fontSize: "0.8rem",
                                    fontFamily: "inherit",
                                    cursor: "pointer",
                                    marginTop: 4,
                                }}
                            >
                                <i className="bx bx-plus"/>
                                Добавить «{trimmedQuery}»
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
