"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { AdminRefreshProvider, useAdminRefreshControls } from "./AdminRefreshContext"
import NotificationBell from "@/components/Community/NotificationBell"

const NAV = [
  { href: "/admin", label: "Дашборд", icon: "bx-home-alt" },
  { href: "/admin/specialists", label: "Специалисты", icon: "bx-user-check" },
  { href: "/admin/clients", label: "Заказчики", icon: "bx-user" },
  { href: "/admin/orders", label: "Заказы", icon: "bx-folder-open" },
  { href: "/admin/payments", label: "Платежи", icon: "bx-credit-card" },
  { href: "/admin/landing", label: "Лендинг", icon: "bx-globe" },
  { href: "/admin/audit", label: "Аудит", icon: "bx-history" },
]

interface AdminLayoutProps {
  children: ReactNode
  noPadding?: boolean
}

export function AdminLayout({ children, noPadding }: AdminLayoutProps) {
  return (
    <AdminRefreshProvider>
      <AdminLayoutShell noPadding={noPadding}>{children}</AdminLayoutShell>
    </AdminRefreshProvider>
  )
}

function AdminLayoutShell({ children, noPadding }: AdminLayoutProps) {
  const pathname = usePathname()
  const { runRefresh, refreshing } = useAdminRefreshControls()

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-logo">
          <Link href="/admin" className="adm-logo-link">
            <i className="bx bx-grid-alt adm-logo-icon" />
          </Link>
        </div>
        <nav className="adm-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`adm-nav-item${isActive(item.href) ? " adm-nav-item--active" : ""}`}
            >
              <i className={`bx ${item.icon}`} />
            </Link>
          ))}
        </nav>
        <div className="adm-sidebar-bottom">
          <Link href="/" title="На сайт" className="adm-nav-item">
            <i className="bx bx-globe" />
          </Link>
        </div>
      </aside>

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
            <NotificationBell />
            <button
              type="button"
              className="adm-header-refresh"
              title="Обновить данные текущей страницы без перезагрузки (на дашборде — обновление с сервера)"
              aria-label="Обновить"
              disabled={refreshing}
              onClick={() => void runRefresh()}
            >
              <i className={`bx bx-refresh${refreshing ? " adm-header-refresh--spin" : ""}`} />
            </button>
            <div className="adm-profile">
              <span className="adm-profile-avatar">
                <i className="bx bx-user" />
              </span>
              <span className="adm-profile-label">Админ</span>
            </div>
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
            --adm-name-color:     #cbd5e1;
          }
        }

        .adm-root {
          display: flex; height: 100vh;
          background: var(--adm-outer);
          color: var(--adm-text);
          overflow: hidden; font-size: 0.875rem;
        }

        .adm-sidebar {
          width: 72px; flex-shrink: 0;
          background: var(--adm-sidebar);
          border-right: 1px solid var(--adm-sidebar-border);
          display: flex; flex-direction: column;
        }
        .adm-logo {
          height: 56px; display: flex;
          align-items: center; justify-content: center;
          border-bottom: 1px solid var(--adm-sidebar-border);
          flex-shrink: 0;
        }
        .adm-logo-link { text-decoration: none; color: var(--adm-active-color); font-size: 1.6rem; display: flex; }
        .adm-logo-icon { font-size: 1.6rem; }
        .adm-nav {
          display: flex; flex-direction: column;
          gap: 6px; padding: 8px; flex: 1;
        }
        .adm-sidebar-bottom { padding: 8px; }
        .adm-nav-item {
          width: 100%; display: flex;
          align-items: center; justify-content: center;
          height: 40px; border-radius: 8px;
          text-decoration: none; color: var(--adm-muted);
          font-size: 1.25rem;
          transition: background 0.15s, color 0.15s;
        }
        .adm-nav-item:hover {
          background: var(--adm-hover-bg);
          color: var(--adm-active-color);
        }
        .adm-nav-item--active {
          background: var(--adm-active-bg);
          color: var(--adm-active-color);
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
          align-items: stretch; gap: 0;
        }
        .adm-tab {
          display: inline-flex; align-items: center;
          padding: 0 16px; height: 100%;
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
        .adm-header-refresh {
          width: 34px; height: 34px; padding: 0;
          border-radius: 8px;
          border: 1px solid var(--adm-sidebar-border);
          background: transparent;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--adm-muted);
          font-size: 1.15rem;
          line-height: 1;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .adm-header-refresh:hover:not(:disabled) {
          color: var(--adm-active-color);
          border-color: var(--adm-active-color);
          background: var(--adm-hover-bg);
        }
        .adm-header-refresh:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        @keyframes adm-refresh-spin {
          to { transform: rotate(360deg); }
        }
        .adm-header-refresh--spin {
          display: inline-block;
          animation: adm-refresh-spin 0.75s linear infinite;
        }
        .adm-profile {
          display: flex; align-items: center; gap: 8px;
          cursor: default;
        }
        .adm-profile-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--adm-active-bg);
          color: var(--adm-active-color);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem;
        }
        .adm-profile-label {
          font-size: 0.82rem; color: var(--adm-text);
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
          /* Reclaim width: the avatar still shows, only the text label is hidden. */
          .adm-profile-label { display: none; }
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
