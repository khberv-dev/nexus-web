"use client"

import {useEffect, useRef, useState} from "react"
import {usePathname} from "next/navigation"
import {SignOutButton} from "@/components/auth/SignOutButton"

/** Иконка профиля в шапке кабинета: по клику — меню с именем, почтой и выходом. */
export function DashProfileMenu({name, email}: { name?: string | null; email?: string | null }) {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const emailTrim = email?.trim() ?? ""
    const displayName = name?.trim() || emailTrim || "Профиль"
    const showEmail = Boolean(emailTrim && emailTrim !== displayName)

    useEffect(() => {
        setOpen(false)
    }, [pathname])

    useEffect(() => {
        if (!open) return
        const onPointerDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("pointerdown", onPointerDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("pointerdown", onPointerDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    return (
        <div className="dash-profile" ref={rootRef}>
            <button
                type="button"
                className="dash-header__icon-btn dash-profile__btn"
                title={displayName}
                aria-label="Меню профиля"
                aria-haspopup="menu"
                aria-expanded={open}
                data-tour="header-profile"
                onClick={() => setOpen((v) => !v)}
            >
                <i className="bx bx-user" aria-hidden/>
            </button>
            {/* Меню не размонтируем: диалог подтверждения выхода живёт внутри SignOutButton. */}
            <div className="dash-profile__menu" role="menu" hidden={!open}>
                <div className="dash-profile__user">
                    <span className="dash-profile__name" title={displayName}>{displayName}</span>
                    {showEmail && <span className="dash-profile__email" title={emailTrim}>{emailTrim}</span>}
                </div>
                <SignOutButton
                    title="Выйти из кабинета"
                    className="dash-profile__item dash-profile__item--danger"
                    onOpen={() => setOpen(false)}
                >
                    <i className="bx bx-power-off" aria-hidden/>
                    Выйти
                </SignOutButton>
            </div>
        </div>
    )
}
