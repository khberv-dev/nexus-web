"use client"

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import type {Country} from "react-phone-number-input"
import PhoneInput, {getCountryCallingCode} from "react-phone-number-input"
import en from "react-phone-number-input/locale/en"
import ru from "react-phone-number-input/locale/ru"
import "react-phone-number-input/style.css"

const labels = {...en, ...ru}

function CountryOption({country, selected, onClick}: { country: Country; selected: boolean; onClick: () => void }) {
    const code = getCountryCallingCode(country)
    const name = labels[country] || country
    const flag = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 12px", border: "none", cursor: "pointer", fontFamily: "inherit",
                background: selected ? "rgba(255,255,255,0.1)" : "transparent",
                color: "#f4f4f4", fontSize: "0.82rem", textAlign: "left",
            }}
            onMouseEnter={e => {
                if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.06)"
            }}
            onMouseLeave={e => {
                if (!selected) e.currentTarget.style.background = "transparent"
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flag} alt="" style={{width: 22, height: 15, borderRadius: 2, objectFit: "cover", flexShrink: 0}}/>
            <span style={{flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{name}</span>
            <span style={{color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", flexShrink: 0}}>+{code}</span>
        </button>
    )
}

type MenuPos = { top: number; left: number; width: number; maxHeight: number }

function CustomCountrySelect({value, onChange, options}: {
    value?: Country; onChange: (c: Country) => void; options: { value?: Country; label: string }[]
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const triggerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const [menuPos, setMenuPos] = useState<MenuPos>({top: 0, left: 0, width: 280, maxHeight: 320})

    const close = useCallback(() => {
        setOpen(false);
        setSearch("")
    }, [])

    const updatePosition = useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const w = Math.min(280, Math.max(220, window.innerWidth - 24))
        let left = rect.left
        if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8)
        if (left < 8) left = 8

        const gap = 4
        const cap = 320
        const spaceBelow = window.innerHeight - rect.bottom - gap - 10
        const spaceAbove = rect.top - gap - 10
        const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
        let maxHeight = openUp ? Math.min(cap, spaceAbove) : Math.min(cap, spaceBelow)
        maxHeight = Math.max(100, maxHeight)

        let top: number
        if (openUp) {
            top = rect.top - maxHeight - gap
            if (top < 8) {
                top = 8
                maxHeight = Math.min(maxHeight, rect.top - gap - 8)
            }
        } else {
            top = rect.bottom + gap
            if (top + maxHeight > window.innerHeight - 8) {
                maxHeight = Math.max(100, window.innerHeight - top - 8)
            }
        }

        setMenuPos({top, left, width: w, maxHeight})
    }, [])

    useLayoutEffect(() => {
        if (!open) return
        updatePosition()
        const onReposition = () => updatePosition()
        window.addEventListener("scroll", onReposition, true)
        window.addEventListener("resize", onReposition)
        return () => {
            window.removeEventListener("scroll", onReposition, true)
            window.removeEventListener("resize", onReposition)
        }
    }, [open, updatePosition])

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const t = e.target as Node
            if (triggerRef.current?.contains(t)) return
            if (dropdownRef.current?.contains(t)) return
            close()
        }
        document.addEventListener("mousedown", handler)
        queueMicrotask(() => searchRef.current?.focus())
        return () => document.removeEventListener("mousedown", handler)
    }, [open, close])

    // Scroll to selected on open
    useEffect(() => {
        if (!open || !listRef.current || !value) return
        const el = listRef.current.querySelector(`[data-country="${value}"]`) as HTMLElement
        if (el) el.scrollIntoView({block: "center"})
    }, [open, value])

    const countries = options
        .filter(o => o.value)
        .map(o => o.value as Country)
        .filter(c => {
            if (!search) return true
            const s = search.toLowerCase()
            const name = (labels[c] || c).toLowerCase()
            const code = getCountryCallingCode(c)
            return name.includes(s) || code.includes(s) || c.toLowerCase().includes(s)
        })

    const flag = value ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${value}.svg` : null

    const menu =
        open &&
        typeof document !== "undefined" &&
        createPortal(
            <div
                ref={dropdownRef}
                style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                    width: menuPos.width,
                    maxHeight: menuPos.maxHeight,
                    zIndex: 5000,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "rgba(22, 22, 28, 0.94)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div style={{padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0}}>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Поиск страны..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.06)",
                            color: "#f4f4f4",
                            fontSize: "0.85rem",
                            outline: "none",
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                        }}
                    />
                </div>
                <div
                    ref={listRef}
                    style={{
                        overflowY: "auto",
                        flex: 1,
                        minHeight: 0,
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(255,255,255,0.15) transparent",
                    }}
                >
                    {countries.map(c => (
                        <div key={c} data-country={c}>
                            <CountryOption country={c} selected={c === value} onClick={() => {
                                onChange(c);
                                close()
                            }}/>
                        </div>
                    ))}
                    {countries.length === 0 && (
                        <p style={{
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "0.8rem",
                            textAlign: "center",
                            padding: 16
                        }}>Не найдено</p>
                    )}
                </div>
            </div>,
            document.body
        )

    return (
        <div ref={triggerRef} className="PhoneField-country" style={{position: "relative", flexShrink: 0}}>
            <button
                type="button"
                className="PhoneField-countryBtn"
                onClick={() => setOpen(!open)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    minWidth: 56,
                    height: "100%",
                    minHeight: 48,
                    padding: "0 12px",
                    boxSizing: "border-box",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 12,
                    cursor: "pointer",
                    color: "#f4f4f4",
                }}
            >
                {flag && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flag} alt="" style={{width: 22, height: 15, borderRadius: 2, objectFit: "cover"}}/>
                )}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{opacity: 0.45}}>
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                          strokeLinejoin="round"/>
                </svg>
            </button>
            {menu}
        </div>
    )
}

interface Props {
    value: string
    onChange: (val: string) => void
    required?: boolean
    className?: string
}

export function PhoneField({value, onChange, required, className}: Props) {
    return (
        <PhoneInput
            international
            defaultCountry="RU"
            countrySelectComponent={CustomCountrySelect}
            value={value || ""}
            onChange={v => onChange(v ?? "")}
            required={required}
            className={className}
        />
    )
}
