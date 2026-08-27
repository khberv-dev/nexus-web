"use client"

import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from "react"
import {subscribeToOrderChat} from "@/lib/client/order-chat-socket"

type ChatSender = { id: string; name: string | null; email: string | null; role: string }

type ChatMessage = {
    id: string
    body: string
    createdAt: string
    sender: ChatSender
}

function chatLoadErrorMessage(status: number, body: unknown): string {
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const err = typeof o.error === "string" ? o.error : null
    const hint = typeof o.hint === "string" ? o.hint : null
    if (err && hint) return `${err} ${hint}`
    if (err) return err
    if (status === 403) return "Нет доступа к чату"
    return "Не удалось загрузить чат"
}

function chatSendErrorMessage(body: unknown): string {
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const err = typeof o.error === "string" ? o.error : "Не отправлено"
    const hint = typeof o.hint === "string" ? ` ${o.hint}` : ""
    return `${err}${hint}`
}

export type OrderChatPanelHandle = {
    focusComposer: () => void
}

export function openOrderChat(
    orderId: string,
    opts?: { focus?: boolean; channel?: "ADMIN_CLIENT" | "ADMIN_SPECIALIST" },
) {
    if (typeof window === "undefined") return
    window.dispatchEvent(
        new CustomEvent("order-chat:open", {
            detail: {orderId, focus: Boolean(opts?.focus), channel: opts?.channel ?? null},
        }),
    )
}

type OrderChatPanelProps = {
    orderId: string
    viewerRole: "CLIENT" | "SPECIALIST" | "ADMIN"
    channel: "ADMIN_CLIENT" | "ADMIN_SPECIALIST" | "ALL"
    /** Увеличьте число, чтобы кратко подсветить панель. */
    emphasizeSignal?: number
    /** Внутри выезжающей шторки — без дублирующего заголовка, на всю высоту контейнера. */
    inDrawer?: boolean
    /** Минимальное число строк в поле ввода (авторесайз). */
    composerMinRows?: number
    /** Максимальное число строк в поле ввода (авторесайз). */
    composerMaxRows?: number
}

export const OrderChatPanel = forwardRef<OrderChatPanelHandle, OrderChatPanelProps>(function OrderChatPanel(
    {orderId, viewerRole, channel, emphasizeSignal, inDrawer, composerMinRows = 1, composerMaxRows = 4},
    ref,
) {
    const [viewerId, setViewerId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [emphasize, setEmphasize] = useState(false)
    const [adminViewChannel, setAdminViewChannel] = useState<"ADMIN_CLIENT" | "ADMIN_SPECIALIST">("ADMIN_CLIENT")
    const [unreadByChannel, setUnreadByChannel] = useState<{ ADMIN_CLIENT: number; ADMIN_SPECIALIST: number }>({
        ADMIN_CLIENT: 0,
        ADMIN_SPECIALIST: 0,
    })
    const bottomRef = useRef<HTMLDivElement>(null)
    const messagesScrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const resizeComposer = useCallback(() => {
        const ta = textareaRef.current
        if (!ta) return

        // Reset to recompute scrollHeight correctly.
        ta.style.height = "auto"

        const cs = window.getComputedStyle(ta)
        const lineHeight = Number.parseFloat(cs.lineHeight || "0") || 18
        const padTop = Number.parseFloat(cs.paddingTop || "0") || 0
        const padBottom = Number.parseFloat(cs.paddingBottom || "0") || 0

        const minPx = composerMinRows * lineHeight + padTop + padBottom
        const maxPx = composerMaxRows * lineHeight + padTop + padBottom

        const next = Math.min(Math.max(ta.scrollHeight, minPx), maxPx)
        ta.style.height = `${next}px`
    }, [composerMaxRows, composerMinRows])

    useImperativeHandle(ref, () => ({
        focusComposer: () => textareaRef.current?.focus({preventScroll: false}),
    }))

    useEffect(() => {
        resizeComposer()
    }, [resizeComposer, draft])

    useEffect(() => {
        if (emphasizeSignal == null || emphasizeSignal <= 0) return
        setEmphasize(true)
        const t = window.setTimeout(() => setEmphasize(false), 2200)
        return () => window.clearTimeout(t)
    }, [emphasizeSignal])

    const scrollToBottom = useCallback(() => {
        const el = messagesScrollRef.current
        if (el) {
            el.scrollTo({top: el.scrollHeight, behavior: "smooth"})
            return
        }
        bottomRef.current?.scrollIntoView({behavior: "smooth", block: "nearest"})
    }, [])

    useEffect(() => {
        // При переключении канала не оставляем “старую” ленту — иначе кажется, что общий чат везде одинаковый.
        setMessages([])
        setError(null)
        setLoading(true)
        if (viewerRole === "ADMIN" && channel === "ALL") setAdminViewChannel("ADMIN_CLIENT")
    }, [orderId, channel, viewerRole])

    const effectiveViewChannel: "ADMIN_CLIENT" | "ADMIN_SPECIALIST" | "ALL" =
        viewerRole === "ADMIN" && channel === "ALL" ? adminViewChannel : channel

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/orders/${orderId}/chat?channel=${encodeURIComponent(effectiveViewChannel)}`)
            let data: unknown = null
            try {
                data = await r.json()
            } catch {
                data = null
            }
            const payload = data && typeof data === "object" ? (data as {
                messages?: unknown;
                viewerId?: unknown
            }) : null
            if (!r.ok || !payload || !Array.isArray(payload.messages)) {
                setError(chatLoadErrorMessage(r.status, data))
                return
            }
            setViewerId(typeof payload.viewerId === "string" ? payload.viewerId : null)
            setMessages(payload.messages as ChatMessage[])
            setError(null)
        } catch {
            setError("Не удалось загрузить чат")
        } finally {
            setLoading(false)
        }
    }, [orderId, effectiveViewChannel])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        const id = setInterval(() => {
            if (typeof document !== "undefined" && document.visibilityState === "visible") void load()
        }, 12000)
        return () => clearInterval(id)
    }, [load])

    useEffect(() => {
        scrollToBottom()
    }, [messages.length, scrollToBottom])

    const send = async () => {
        const text = draft.trim()
        if (!text || sending) return
        setSending(true)
        setError(null)
        try {
            const effectiveChannel =
                viewerRole === "ADMIN" && channel === "ALL"
                    ? adminViewChannel
                    : (channel as "ADMIN_CLIENT" | "ADMIN_SPECIALIST")
            const r = await fetch(`/api/orders/${orderId}/chat?channel=${encodeURIComponent(effectiveViewChannel)}`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({body: text, sendChannel: effectiveChannel}),
            })
            let data: unknown = null
            try {
                data = await r.json()
            } catch {
                data = null
            }
            const payload = data && typeof data === "object" ? (data as { message?: unknown }) : null
            if (!r.ok || !payload?.message) {
                setError(chatSendErrorMessage(data))
                return
            }
            setDraft("")
            // Не добавляем сообщение “вручную”, чтобы не показывать его в неправильной вкладке.
            await load()
            await markRead()
            await fetchUnreadBadges()
        } catch {
            setError("Не удалось отправить")
        } finally {
            setSending(false)
        }
    }

    const markRead = useCallback(async () => {
        const readChannel = viewerRole === "ADMIN" && channel === "ALL" ? "ALL" : effectiveViewChannel
        try {
            await fetch(`/api/orders/${orderId}/chat/read?channel=${encodeURIComponent(readChannel)}`, {method: "POST"})
        } catch {
            // ignore
        }
    }, [orderId, viewerRole, channel, effectiveViewChannel])

    const fetchUnreadBadges = useCallback(async () => {
        const channels: Array<"ADMIN_CLIENT" | "ADMIN_SPECIALIST"> =
            viewerRole === "ADMIN" && channel === "ALL"
                ? ["ADMIN_CLIENT", "ADMIN_SPECIALIST"]
                : []
        if (channels.length === 0) return
        try {
            const results = await Promise.all(
                channels.map(async (ch) => {
                    const res = await fetch(`/api/orders/${orderId}/chat/unread?channel=${encodeURIComponent(ch)}`, {cache: "no-store"})
                    const json = (await res.json().catch(() => ({}))) as { unread?: unknown }
                    const nRaw = json.unread
                    const n =
                        typeof nRaw === "number"
                            ? nRaw
                            : typeof nRaw === "string"
                                ? Number.parseInt(nRaw, 10)
                                : 0
                    return [ch, Number.isFinite(n) && n > 0 ? n : 0] as const
                }),
            )
            setUnreadByChannel((prev) => {
                const next = {...prev}
                for (const [k, v] of results) next[k] = v
                return next
            })
        } catch {
            // ignore
        }
    }, [viewerRole, channel, orderId])

    useEffect(() => {
        void fetchUnreadBadges()
        const id = window.setInterval(() => {
            if (document.visibilityState === "visible") void fetchUnreadBadges()
        }, 12000)
        return () => window.clearInterval(id)
    }, [viewerRole, channel, fetchUnreadBadges])

    useEffect(() => {
        void (async () => {
            await markRead()
            await fetchUnreadBadges()
        })()
    }, [markRead, fetchUnreadBadges])

    useEffect(() => subscribeToOrderChat(orderId, (event) => {
        if (event.type === "chat.message") {
            void (async () => {
                await load()
                await markRead()
                await fetchUnreadBadges()
            })()
        } else if (event.type === "chat.read") {
            void fetchUnreadBadges()
        }
    }), [orderId, load, markRead, fetchUnreadBadges])

    const labelFor = (m: ChatMessage) => {
        if (viewerId && m.sender.id === viewerId) return "Вы"
        if (m.sender.role === "SPECIALIST") return "Дизайнер"
        if (m.sender.role === "CLIENT") return "Заказчик"
        if (m.sender.role === "ADMIN") return "Администратор"
        return m.sender.name ?? m.sender.email?.split("@")[0] ?? "Участник"
    }

    const counterpartHint =
        viewerRole === "CLIENT"
            ? "Чат с администратором — вопросы по проекту и согласования."
            : viewerRole === "SPECIALIST"
                ? "Чат с администратором — уточнения по правкам и статусам."
                : channel === "ADMIN_CLIENT"
                    ? "Канал админ ↔ заказчик."
                    : channel === "ADMIN_SPECIALIST"
                        ? "Канал админ ↔ дизайнер."
                        : "Выберите канал: Заказчик / Дизайнер. Сообщения и отправка — внутри выбранного канала."

    return (
        <div
            className={[inDrawer ? "stage-chat-panel--drawer" : undefined].filter(Boolean).join(" ") || undefined}
            style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--dash-surface)",
                border: inDrawer ? "none" : "1px solid var(--dash-border)",
                borderRadius: inDrawer ? 0 : 12,
                overflow: "hidden",
                ...(inDrawer
                    ? {flex: 1, minHeight: 0, maxHeight: "100%", width: "100%", alignSelf: "stretch", height: "100%"}
                    : {minHeight: 280, maxHeight: "min(560px, 70vh)"}),
                outline: emphasize ? "2px solid var(--dash-accent)" : "2px solid transparent",
                outlineOffset: inDrawer ? 0 : 2,
                transition: "outline-color 0.25s ease, box-shadow 0.25s ease",
                boxShadow: emphasize ? "0 0 22px color-mix(in srgb, var(--dash-accent) 35%, transparent)" : undefined,
            }}
        >
            {!inDrawer ? (
                <div
                    style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--dash-border)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        color: "var(--dash-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <i className="bx bx-message-dots" style={{color: "var(--dash-accent)", fontSize: "1rem"}}
                       aria-hidden/>
                    {viewerRole === "ADMIN"
                        ? channel === "ADMIN_CLIENT"
                            ? "Чат: админ ↔ заказчик"
                            : channel === "ADMIN_SPECIALIST"
                                ? "Чат: админ ↔ дизайнер"
                                : "Чат"
                        : "Чат с администратором"}
                </div>
            ) : null}

            {viewerRole === "ADMIN" && channel === "ALL" ? (
                <div style={{
                    padding: inDrawer ? "10px 14px 0" : "8px 14px 0",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                }}>
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        {([
                            {key: "ADMIN_CLIENT", label: "Заказчик"},
                            {key: "ADMIN_SPECIALIST", label: "Дизайнер"},
                        ] as const).map((t) => {
                            const active = adminViewChannel === t.key
                            const badge = unreadByChannel[t.key]
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setAdminViewChannel(t.key)}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        border: `1px solid ${active ? "var(--dash-accent-border)" : "var(--dash-border)"}`,
                                        background: active ? "var(--dash-accent-bg)" : "var(--dash-surface2)",
                                        color: active ? "var(--dash-accent)" : "var(--dash-text2)",
                                        cursor: "pointer",
                                        fontSize: "0.78rem",
                                        fontWeight: 700,
                                        fontFamily: "inherit",
                                    }}
                                >
                                    {t.label}
                                    {badge > 0 ? (
                                        <span
                                            style={{
                                                minWidth: 18,
                                                height: 18,
                                                padding: "0 6px",
                                                borderRadius: 999,
                                                background: "rgba(239,68,68,0.95)",
                                                color: "#fff",
                                                fontSize: "0.68rem",
                                                fontWeight: 800,
                                                lineHeight: "18px",
                                            }}
                                            title={`Непрочитанные: ${badge}`}
                                        >
                      {badge > 99 ? "99+" : badge}
                    </span>
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}

            <p
                style={{
                    margin: 0,
                    padding: inDrawer ? "10px 14px 0" : "8px 14px 0",
                    fontSize: "0.72rem",
                    color: "var(--dash-muted)",
                    lineHeight: 1.45,
                    flexShrink: 0,
                }}
            >
                {counterpartHint}
            </p>

            <div
                ref={messagesScrollRef}
                style={{
                    flex: 1,
                    minHeight: inDrawer ? 0 : 120,
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    scrollbarWidth: "thin",
                    minWidth: 0,
                }}
            >
                {loading ? (
                    <span style={{fontSize: "0.78rem", color: "var(--dash-muted)"}}>Загрузка…</span>
                ) : messages.length === 0 ? (
                    <span style={{fontSize: "0.78rem", color: "var(--dash-muted)"}}>Пока нет сообщений — напишите первым.</span>
                ) : (
                    messages.map((m) => {
                        const mine = viewerId != null && m.sender.id === viewerId
                        return (
                            <div
                                key={m.id}
                                style={{
                                    alignSelf: mine ? "flex-end" : "flex-start",
                                    maxWidth: "92%",
                                    padding: "8px 11px",
                                    borderRadius: 10,
                                    background: mine ? "var(--dash-accent-bg)" : "var(--dash-surface2)",
                                    border: `1px solid ${mine ? "var(--dash-accent-border)" : "var(--dash-border)"}`,
                                }}
                            >
                                <div style={{fontSize: "0.65rem", color: "var(--dash-muted)", marginBottom: 4}}>
                                    {labelFor(m)}
                                    <span style={{marginLeft: 8, opacity: 0.85}}>
                    {new Date(m.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                  </span>
                                </div>
                                <div style={{
                                    fontSize: "0.82rem",
                                    color: "var(--dash-text)",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word"
                                }}>
                                    {m.body}
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef}/>
            </div>

            {error && <div style={{padding: "0 12px", fontSize: "0.72rem", color: "var(--dash-danger)"}}>{error}</div>}

            <div
                style={{
                    padding: inDrawer ? "12px 0 0" : 10,
                    marginTop: inDrawer ? 4 : undefined,
                    borderTop: "1px solid var(--dash-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flexShrink: 0,
                    minWidth: 0,
                    boxSizing: "border-box",
                    background: inDrawer ? "var(--dash-surface)" : undefined,
                }}
            >
        <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Сообщение…"
            rows={composerMinRows}
            disabled={sending}
            style={{
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                resize: inDrawer ? "none" : "vertical",
                overflowY: "auto",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--dash-border)",
                background: "var(--dash-bg)",
                color: "var(--dash-text)",
                fontFamily: "inherit",
                fontSize: "0.82rem",
                lineHeight: 1.4,
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void send()
                }
            }}
        />
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    minWidth: 0
                }}>
                    <span style={{minWidth: 0, flex: 1}}/>
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={sending || !draft.trim()}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "none",
                            background: draft.trim() ? "var(--dash-accent)" : "var(--dash-border)",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            cursor: draft.trim() && !sending ? "pointer" : "default",
                            fontFamily: "inherit",
                            opacity: sending ? 0.75 : 1,
                            flexShrink: 0,
                            marginLeft: "auto",
                        }}
                    >
                        {sending ? "Отправка…" : "Отправить"}
                    </button>
                </div>
                <span style={{
                    fontSize: "0.65rem",
                    color: "var(--dash-muted)",
                    paddingBottom: inDrawer ? 2 : 0,
                    display: "block"
                }}>
          Ctrl+Enter — отправить
        </span>
            </div>
        </div>
    )
})

OrderChatPanel.displayName = "OrderChatPanel"
