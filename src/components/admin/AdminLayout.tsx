"use client"

import Link from "next/link"
import {usePathname} from "next/navigation"
import {type ReactNode, useEffect, useRef, useState} from "react"
import {AdminRefreshProvider} from "./AdminRefreshContext"
import {useAdminViewer} from "./AdminViewerContext"
import NotificationBell from "@/components/Community/NotificationBell"
import {SignOutButton} from "@/components/auth/SignOutButton"
import {Icon} from "@/components/ui/icon"

const NAV = [
    {href: "/admin", label: "Дашборд", icon: "bx-home-alt"},
    {href: "/admin/specialists", label: "Специалисты", icon: "bx-user-check"},
    {href: "/admin/clients", label: "Заказчики", icon: "bx-user"},
    {href: "/admin/orders", label: "Заказы", icon: "bx-folder-open"},
    {href: "/admin/payments", label: "Платежи", icon: "bx-credit-card"},
    {href: "/admin/landing", label: "Лендинг", icon: "bx-globe"},
    {href: "/admin/regulations", label: "Регламент", icon: "bx-book-open"},
    {href: "/admin/audit", label: "Аудит", icon: "bx-history"},
]

interface AdminLayoutProps {
    children: ReactNode
    noPadding?: boolean
}

export function AdminLayout({children, noPadding}: AdminLayoutProps) {
    return (
        <AdminRefreshProvider>
            <AdminLayoutShell noPadding={noPadding}>{children}</AdminLayoutShell>
        </AdminRefreshProvider>
    )
}

/** Иконка профиля в шапке: по клику — меню с выходом. */
function AdminProfileMenu() {
    const pathname = usePathname()
    const viewer = useAdminViewer()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const displayName = viewer?.name?.trim() || viewer?.email || "Администратор"
    const showEmail = Boolean(viewer?.email && viewer.email !== displayName)

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
        <div className="adm-profile" ref={rootRef}>
            <button
                type="button"
                className="adm-header-icon-btn adm-profile-avatar"
                title={displayName}
                aria-label="Меню профиля"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <Icon name="user"/>
            </button>
            {/* Меню не размонтируем: диалог подтверждения выхода живёт внутри SignOutButton. */}
            <div className="adm-profile-menu" role="menu" hidden={!open}>
                <div className="adm-profile-menu__user">
                    <span className="adm-profile-menu__name" title={displayName}>{displayName}</span>
                    {showEmail && <span className="adm-profile-menu__email" title={viewer!.email}>{viewer!.email}</span>}
                </div>
                <SignOutButton
                    title="Выйти из админки"
                    className="adm-profile-menu__item adm-profile-menu__item--danger"
                    onOpen={() => setOpen(false)}
                >
                    <Icon name="power-off"/>
                    Выйти
                </SignOutButton>
            </div>
        </div>
    )
}

function AdminLayoutShell({children, noPadding}: AdminLayoutProps) {
    const pathname = usePathname()

    const isActive = (href: string) =>
        href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

    return (
        <div className="adm-root">
            <div className="adm-main">
                <header className="adm-header">
                    <nav className="adm-tabs">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`adm-tab${isActive(item.href) ? " adm-tab--active" : ""}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="adm-header-right">
                        <NotificationBell buttonClassName="adm-header-icon-btn adm-header-bell"/>
                        <AdminProfileMenu/>
                    </div>
                </header>

                <div className={`adm-content${noPadding ? " adm-content--np" : ""}`}>{children}</div>
            </div>

            <style>{`
        .adm-root {
          --adm-outer:          #f3f4f6;
          --adm-sidebar:        #ffffff;
          --adm-sidebar-border: #e5e7eb;
          --adm-text:           #111827;
          --adm-muted:          #9ca3af;
          --adm-active-bg:      rgba(99,102,241,0.10);
          --adm-active-color:   #6366f1;
          --adm-hover-bg:       rgba(99,102,241,0.06);
          --adm-content-bg:     #ffffff;
          --adm-card-bg:        #f7f8fa;
          --adm-name-color:     #4b5563;
        }
        @media (prefers-color-scheme: dark) {
          .adm-root {
            --adm-outer:          #0f172a;
            --adm-sidebar:        #1e293b;
            --adm-sidebar-border: #334155;
            --adm-text:           #f1f5f9;
            --adm-muted:          #94a3b8;
            --adm-active-bg:      rgba(129,140,248,0.18);
            --adm-active-color:   #818cf8;
            --adm-hover-bg:       rgba(129,140,248,0.10);
            --adm-content-bg:     #0f172a;
            --adm-card-bg:        #16213c;
            --adm-name-color:     #cbd5e1;
          }
        }

        .adm-root {
          display: flex; height: 100vh;
          background: var(--adm-outer);
          color: var(--adm-text);
          overflow: hidden; font-size: 0.875rem;
        }

        .adm-header {
          height: 56px; flex-shrink: 0;
          display: flex; align-items: center;
          padding: 0 24px;
          border-bottom: 1px solid var(--adm-sidebar-border);
          background: var(--adm-content-bg);
          gap: 16px;
        }
        .adm-tabs {
          display: flex; height: 100%;
          align-items: center; gap: 0;
        }
        .adm-tab {
          display: inline-flex; align-items: center;
          padding: 0 16px; height: 36px;
          text-decoration: none; color: var(--adm-muted);
          border-bottom: 2px solid transparent;
          font-size: 0.85rem; font-weight: 500;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .adm-tab:hover { color: var(--adm-text); }
        .adm-tab--active {
          color: var(--adm-active-color);
          border-bottom-color: var(--adm-active-color);
        }
        @media (prefers-color-scheme: dark) {
          .adm-tab--active { color: #fff; border-bottom-color: #fff; }
        }
        .adm-header-right {
          margin-left: auto; display: flex;
          align-items: center; gap: 12px;
        }

        /* ── Профиль: иконка открывает меню, в нём — выход ── */
        /* Колокольчик и профиль — одинаковые круглые кнопки 36×36, по центру шапки. */
        .adm-header-right > * { display: flex; align-items: center; }
        .adm-header-icon-btn {
          position: relative;
          width: 36px; height: 36px; padding: 0; border-radius: 50%;
          border: 1px solid transparent;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.15rem; line-height: 1; cursor: pointer;
          transition: color 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .adm-header-icon-btn i { line-height: 1; }
        .adm-header-icon-btn:hover,
        .adm-header-icon-btn[aria-expanded="true"] {
          box-shadow: 0 0 0 3px var(--adm-hover-bg);
        }
        .adm-header-icon-btn:focus-visible { outline: 2px solid var(--adm-active-color); outline-offset: 2px; }
        .adm-header-bell {
          background: transparent;
          border-color: var(--adm-sidebar-border);
          color: var(--adm-muted);
        }
        .adm-header-bell:hover,
        .adm-header-bell[aria-expanded="true"] { color: var(--adm-active-color); background: var(--adm-hover-bg); box-shadow: none; }
        /* Счётчик непрочитанных — на краю круга, а не внутри. */
        .adm-header-bell > span { top: -3px !important; right: -3px !important; }
        .adm-profile { position: relative; }
        .adm-profile-avatar {
          background: var(--adm-active-bg);
          color: var(--adm-active-color);
        }
        .adm-profile-menu {
          position: absolute; top: calc(100% + 8px); right: 0; z-index: 1100;
          min-width: 180px; padding: 6px;
          display: flex; flex-direction: column;
          background: var(--adm-card-bg);
          border-radius: 10px;
        }
        .adm-profile-menu[hidden] { display: none; }
        .adm-profile-menu__user {
          display: flex; flex-direction: column; gap: 2px;
          padding: 8px 10px 10px; margin-bottom: 4px;
          border-bottom: 1px solid var(--adm-sidebar-border);
          max-width: 260px;
        }
        .adm-profile-menu__name,
        .adm-profile-menu__email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adm-profile-menu__name { font-size: 0.875rem; font-weight: 600; color: var(--adm-text); }
        .adm-profile-menu__email { font-size: 0.75rem; color: var(--adm-muted); }
        .adm-profile-menu__item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 8px 10px; border-radius: 7px;
          background: transparent; color: var(--adm-text);
          font-size: 0.85rem; text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .adm-profile-menu__item i { font-size: 1.05rem; }
        .adm-profile-menu__item--danger { color: var(--adm-danger, #ea5455); }
        .adm-profile-menu__item--danger:hover,
        .adm-profile-menu__item--danger:focus-visible {
          background: rgba(234,84,85,0.12);
          outline: none;
        }

        .adm-main {
          display: flex; flex-direction: column;
          flex: 1; overflow: hidden;
          background: var(--adm-content-bg);
        }
        .adm-content {
          flex: 1; overflow-y: auto;
          padding: 24px; color: var(--adm-text);
        }
        .adm-content--np {
          padding: 0; overflow: hidden;
          display: flex; flex-direction: column;
        }

        /* UI1 — mobile responsiveness. Desktop rules above are untouched. */
        @media (max-width: 768px) {
          .adm-header { padding: 0 12px; gap: 8px; }
          /* 7 nowrap tabs would overflow the viewport — let the bar scroll. */
          .adm-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .adm-tabs::-webkit-scrollbar { display: none; }
          .adm-tab { padding: 0 12px; }
          .adm-content { padding: 12px; }
          /* Keep the no-padding split-view panels full-bleed (equal specificity + source order
             would otherwise let the 12px above leak onto them). */
          .adm-content--np { padding: 0; }
          /* Wide tables should scroll inside the content, not blow out the page. */
          .adm-content table { display: block; overflow-x: auto; max-width: 100%; }
        }
      `}</style>
        </div>
    )
}
