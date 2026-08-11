"use client"

import Link from "next/link"
import {useCallback, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import {usePathname} from "next/navigation"
import NotificationBell from "@/components/Community/NotificationBell"
import {DashRightDrawer} from "@/components/dashboard-ui/DashRightDrawer"
import {OrderChatPanel, type OrderChatPanelHandle} from "@/components/dashboard-ui/OrderChatPanel"

export type DashHeaderNavItem = {
    href: string
    label: string
    iconClassName?: string
    active?: boolean
}

interface DashTopHeaderProps {
    email: string
    title?: string
    /** Куда ведёт логотип NEXUS (в кабинете заказчика — `/orders`). */
    logoHref?: string
    /** Горизонтальная навигация (например разделы кабинета заказчика). */
    navItems?: DashHeaderNavItem[] | null
    /** Компактный статус (например этап заказа). */
    statusChip?: { label: string; color?: string; background?: string } | null
    primaryAction?: {
        href: string
        label: string
        iconClassName?: string
        /** Неактивная кнопка (например, пока не подписан договор оказания услуг). */
        disabled?: boolean
        disabledTitle?: string
    } | null
    /** Если false — кнопка не в шапке, только в выдвижном меню (рядом с контентом можно вывести свою). */
    showPrimaryActionInHeader?: boolean
    showNotifications?: boolean
    orderChat?: {
        orderId: string
        viewerRole: "CLIENT" | "SPECIALIST" | "ADMIN"
        /** Для ADMIN можно выбрать канал явно; для остальных роли канал фиксирован. */
        channel?: "ADMIN_CLIENT" | "ADMIN_SPECIALIST"
    } | null
}

export function DashTopHeader({
                                  email,
                                  title = "Личный кабинет",
                                  logoHref = "/",
                                  navItems = null,
                                  statusChip = null,
                                  primaryAction = null,
                                  showPrimaryActionInHeader = true,
                                  showNotifications = true,
                                  orderChat = null,
                              }: DashTopHeaderProps) {
    const pathname = usePathname()
    const hasNav = Array.isArray(navItems) && navItems.length > 0
    const emailTrim = email?.trim() ?? ""
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [chatOpen, setChatOpen] = useState(false)
    const [chatEmphasizeSignal, setChatEmphasizeSignal] = useState(0)
    const [unread, setUnread] = useState<number>(0)
    const chatPanelRef = useRef<OrderChatPanelHandle>(null)

    const effectiveChatChannel: "ADMIN_CLIENT" | "ADMIN_SPECIALIST" | null =
        orderChat?.viewerRole === "CLIENT"
            ? "ADMIN_CLIENT"
            : orderChat?.viewerRole === "SPECIALIST"
                ? "ADMIN_SPECIALIST"
                : orderChat?.viewerRole === "ADMIN"
                    ? (orderChat.channel ?? "ADMIN_CLIENT")
                    : null

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        setDrawerOpen(false)
    }, [pathname])

    useEffect(() => {
        if (!orderChat?.orderId) return
        const onOpen = (e: Event) => {
            const ce = e as CustomEvent<{ orderId?: string; focus?: boolean; channel?: unknown }>
            const id = ce.detail?.orderId
            if (!id || id !== orderChat.orderId) return
            const ch = ce.detail?.channel
            if (ch === "ADMIN_CLIENT" || ch === "ADMIN_SPECIALIST") {
                // allow explicit channel open (useful for shared components)
                if (orderChat.viewerRole === "ADMIN") {
                    // for admins we respect requested channel via props on parent (separate admin UI handles switching)
                }
                // for client/specialist, ignore: channel is derived from role
            }
            setChatOpen(true)
            setChatEmphasizeSignal((n) => n + 1)
            if (ce.detail?.focus) window.setTimeout(() => chatPanelRef.current?.focusComposer(), 350)
        }
        window.addEventListener("order-chat:open", onOpen as EventListener)
        return () => window.removeEventListener("order-chat:open", onOpen as EventListener)
    }, [orderChat?.orderId])

    const fetchUnread = useCallback(async () => {
        if (!orderChat?.orderId || !effectiveChatChannel) return
        try {
            const res = await fetch(
                `/api/orders/${orderChat.orderId}/chat/unread?channel=${encodeURIComponent(effectiveChatChannel)}`,
                {cache: "no-store"},
            )
            const json = (await res.json().catch(() => ({}))) as { unread?: unknown }
            if (!res.ok) return
            const nRaw = json.unread
            const n =
                typeof nRaw === "number"
                    ? nRaw
                    : typeof nRaw === "string"
                        ? Number.parseInt(nRaw, 10)
                        : 0
            setUnread(Number.isFinite(n) && n > 0 ? n : 0)
        } catch {
            // ignore
        }
    }, [orderChat?.orderId, effectiveChatChannel])

    const markRead = useCallback(async () => {
        if (!orderChat?.orderId || !effectiveChatChannel) return
        try {
            await fetch(`/api/orders/${orderChat.orderId}/chat/read?channel=${encodeURIComponent(effectiveChatChannel)}`, {
                method: "POST",
            })
        } catch {
            // ignore
        } finally {
            // optimistically clear, then resync
            setUnread(0)
            void fetchUnread()
        }
    }, [orderChat?.orderId, effectiveChatChannel, fetchUnread])

    useEffect(() => {
        if (!orderChat?.orderId) return
        void fetchUnread()
        const id = window.setInterval(() => {
            if (document.visibilityState === "visible") void fetchUnread()
        }, 12000)
        return () => window.clearInterval(id)
    }, [orderChat?.orderId, fetchUnread])

    useEffect(() => {
        // Для клиента/дизайнера канал теперь переключаемый внутри панели — не помечаем прочитанным при открытии шторки.
        if (!chatOpen) return
        if (orderChat?.viewerRole === "ADMIN") void markRead()
    }, [chatOpen, markRead, orderChat?.viewerRole])

    useEffect(() => {
        if (!drawerOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setDrawerOpen(false)
        }
        window.addEventListener("keydown", onKey)
        const prev = document.documentElement.style.overflow
        document.documentElement.style.overflow = "hidden"
        return () => {
            window.removeEventListener("keydown", onKey)
            document.documentElement.style.overflow = prev
        }
    }, [drawerOpen])

    const drawer =
        mounted && hasNav && drawerOpen
            ? createPortal(
                <div className="dash-drawer-root" role="presentation">
                    <button
                        type="button"
                        className="dash-drawer-backdrop"
                        aria-label="Закрыть меню"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <aside className="dash-drawer" aria-modal aria-label="Меню кабинета">
                        <div className="dash-drawer__top">
                            <span className="dash-drawer__title">Разделы</span>
                            <button type="button" className="dash-drawer__close" onClick={() => setDrawerOpen(false)}
                                    aria-label="Закрыть">
                                <i className="bx bx-x"/>
                            </button>
                        </div>
                        <nav className="dash-drawer__nav" aria-label="Разделы кабинета">
                            {navItems!.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`dash-drawer__link${item.active ? " dash-drawer__link--active" : ""}`}
                                    aria-current={item.active ? "page" : undefined}
                                    onClick={() => setDrawerOpen(false)}
                                >
                                    {item.iconClassName ? <i className={item.iconClassName} aria-hidden/> : null}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                            {primaryAction ? (
                                primaryAction.disabled ? (
                                    <span
                                        className="dash-drawer__link dash-drawer__link--accent dash-drawer__link--disabled"
                                        title={primaryAction.disabledTitle ?? primaryAction.label}
                                        aria-disabled="true"
                                    >
                  <i className="bx bx-lock-alt" aria-hidden/>
                  <span>{primaryAction.label}</span>
                </span>
                                ) : (
                                    <Link
                                        href={primaryAction.href}
                                        className="dash-drawer__link dash-drawer__link--accent"
                                        onClick={() => setDrawerOpen(false)}
                                    >
                                        {primaryAction.iconClassName ?
                                            <i className={primaryAction.iconClassName} aria-hidden/> : null}
                                        <span>{primaryAction.label}</span>
                                    </Link>
                                )
                            ) : null}
                            <Link href="/" className="dash-drawer__link dash-drawer__link--muted"
                                  onClick={() => setDrawerOpen(false)}>
                                <i className="bx bx-home-alt" aria-hidden/>
                                <span>На главную</span>
                            </Link>
                        </nav>
                        {emailTrim ? (
                            <div className="dash-drawer__footer">
              <span className="dash-drawer__email" title={emailTrim}>
                {emailTrim}
              </span>
                            </div>
                        ) : null}
                    </aside>
                </div>,
                document.body,
            )
            : null

    return (
        <>
            <header className={`dash-header${hasNav ? " dash-header--with-nav" : ""}`}>
                <div className="dash-header__left">
                    {hasNav ? (
                        <button
                            type="button"
                            className="dash-header__menu-btn"
                            aria-label="Открыть меню"
                            aria-expanded={drawerOpen}
                            onClick={() => setDrawerOpen(true)}
                        >
                            <i className="bx bx-menu" aria-hidden/>
                        </button>
                    ) : null}
                    <Link href={logoHref} className="dash-header__logo">
                        NEXUS
                    </Link>
                    <div className="dash-header__tag" title={title}>
                        <span className="dash-header__tag-dot" aria-hidden/>
                        <span className="dash-header__tag-text">{title}</span>
                    </div>
                </div>

                {hasNav ? (
                    <nav className="dash-header__nav" aria-label="Разделы кабинета">
                        {navItems!.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`dash-header__nav-link${item.active ? " dash-header__nav-link--active" : ""}`}
                                aria-current={item.active ? "page" : undefined}
                            >
                                {item.iconClassName ? <i className={item.iconClassName} aria-hidden/> : null}
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                ) : (
                    <div className="dash-header__nav-spacer" aria-hidden/>
                )}

                <div className="dash-header__right">
                    {statusChip ? (
                        <span
                            className="dash-header__status-chip"
                            title={statusChip.label}
                            style={
                                statusChip.color || statusChip.background
                                    ? {
                                        color: statusChip.color ?? undefined,
                                        background: statusChip.background ?? undefined
                                    }
                                    : undefined
                            }
                        >
              {statusChip.label}
            </span>
                    ) : null}
                    {showNotifications ? (
                        <div className="dash-header__notif-slot">
                            <NotificationBell/>
                        </div>
                    ) : null}
                    {orderChat?.orderId ? (
                        <button
                            type="button"
                            className="dash-header__btn dash-header__btn--accent"
                            onClick={() => setChatOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={chatOpen}
                            aria-controls={chatOpen ? "order-chat-drawer" : undefined}
                            style={{display: "inline-flex", alignItems: "center", gap: 8, position: "relative"}}
                        >
                            <i className="bx bx-message-dots" aria-hidden/>
                            Чат
                            {unread > 0 ? (
                                <span
                                    title={`Непрочитанные: ${unread}`}
                                    style={{
                                        marginLeft: 2,
                                        minWidth: 18,
                                        height: 18,
                                        padding: "0 6px",
                                        borderRadius: 999,
                                        background: "rgba(239,68,68,0.95)",
                                        color: "#fff",
                                        fontSize: "0.68rem",
                                        fontWeight: 800,
                                        lineHeight: "18px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                  {unread > 99 ? "99+" : unread}
                </span>
                            ) : null}
                        </button>
                    ) : null}
                    {emailTrim ? (
                        <span className="dash-header__email" title={emailTrim}>
              {emailTrim}
            </span>
                    ) : null}
                    {primaryAction && showPrimaryActionInHeader ? (
                        primaryAction.disabled ? (
                            <span
                                className="dash-header__btn dash-header__btn--primary dash-header__btn--disabled"
                                title={primaryAction.disabledTitle ?? primaryAction.label}
                                aria-disabled="true"
                            >
                <i className="bx bx-lock-alt" aria-hidden style={{marginRight: 6}}/>
                                {primaryAction.label}
              </span>
                        ) : (
                            <Link href={primaryAction.href} className="dash-header__btn dash-header__btn--primary">
                                {primaryAction.iconClassName ?
                                    <i className={primaryAction.iconClassName} aria-hidden/> : null}
                                {primaryAction.label}
                            </Link>
                        )
                    ) : null}
                </div>
            </header>
            {drawer}
            {orderChat?.orderId ? (
                <DashRightDrawer
                    open={chatOpen}
                    onClose={() => setChatOpen(false)}
                    title={orderChat.viewerRole === "CLIENT" ? "Чат с администратором" : "Чат"}
                    titleIcon={<i className="bx bx-message-dots" aria-hidden/>}
                    panelWidth="min(460px, min(100vw - 24px, 520px))"
                    zIndex={12050}
                    ariaLabelledBy="order-chat-drawer-title"
                    panelId="order-chat-drawer"
                    scrollableBody={false}
                >
                    {effectiveChatChannel ? (
                        <OrderChatPanel
                            ref={chatPanelRef}
                            emphasizeSignal={chatEmphasizeSignal}
                            orderId={orderChat.orderId}
                            viewerRole={orderChat.viewerRole}
                            channel={effectiveChatChannel}
                            inDrawer
                        />
                    ) : null}
                </DashRightDrawer>
            ) : null}
        </>
    )
}
