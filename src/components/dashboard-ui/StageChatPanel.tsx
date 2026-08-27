"use client"

import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from "react"
import {StageChatAiAssist} from "./StageChatAiAssist"
import {ChatEmojiPicker} from "./ChatEmojiPicker"

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

export type StageChatPanelHandle = {
    focusComposer: () => void
}

type StageChatPanelProps = {
    stageId: string
    orderId: string
    viewerRole: "CLIENT" | "SPECIALIST"
    /** Узкая колонка внутри карточки дизайнера */
    compact?: boolean
    /** Увеличьте число, чтобы кратко подсветить панель (напр. после «На доработку»). */
    emphasizeSignal?: number
    /** Внутри выезжающей шторки — без дублирующего заголовка, на всю высоту контейнера. */
    inDrawer?: boolean
    /** Подсказки ИИ для текста сообщения (кабинет заказчика). */
    aiAssist?: { orderId: string; stageId: string }
}

export const StageChatPanel = forwardRef<StageChatPanelHandle, StageChatPanelProps>(function StageChatPanel(
    {stageId, orderId: _orderId, viewerRole, compact, emphasizeSignal, inDrawer, aiAssist},
    ref,
) {
    void _orderId
    const [viewerId, setViewerId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [emphasize, setEmphasize] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const messagesScrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const insertEmoji = useCallback((emoji: string) => {
        const textarea = textareaRef.current
        const start = textarea?.selectionStart ?? draft.length
        const end = textarea?.selectionEnd ?? draft.length
        setDraft(`${draft.slice(0, start)}${emoji}${draft.slice(end)}`)
        window.requestAnimationFrame(() => {
            textarea?.focus()
            textarea?.setSelectionRange(start + emoji.length, start + emoji.length)
        })
    }, [draft])

    useImperativeHandle(ref, () => ({
        focusComposer: () => {
            textareaRef.current?.focus({preventScroll: false})
        },
    }))

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

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/stages/${stageId}/chat`)
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
    }, [stageId])

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
            const r = await fetch(`/api/stages/${stageId}/chat`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({body: text}),
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
            setMessages(prev => [...prev, payload.message as ChatMessage])
        } catch {
            setError("Не удалось отправить")
        } finally {
            setSending(false)
        }
    }

    const labelFor = (m: ChatMessage) => {
        if (viewerId && m.sender.id === viewerId) return "Вы"
        if (m.sender.role === "SPECIALIST") return "Дизайнер"
        if (m.sender.role === "CLIENT") return "Заказчик"
        return m.sender.name ?? m.sender.email?.split("@")[0] ?? "Участник"
    }

    const counterpartHint =
        viewerRole === "CLIENT"
            ? "Общайтесь с дизайнером по материалам и уточнениям этапа."
            : "Ответьте заказчику по этому этапу."

    return (
        <div
            className={[compact ? "stage-chat-panel--compact" : undefined, inDrawer ? "stage-chat-panel--drawer" : undefined].filter(Boolean).join(" ") || undefined}
            style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--dash-surface)",
                border: inDrawer ? "none" : "1px solid var(--dash-border)",
                borderRadius: inDrawer ? 0 : 12,
                overflow: "hidden",
                ...(inDrawer
                    ? {
                        flex: 1,
                        minHeight: 0,
                        maxHeight: "100%",
                        width: "100%",
                        alignSelf: "stretch",
                        height: "100%",
                    }
                    : {minHeight: compact ? 240 : 280, maxHeight: compact ? "min(420px, 55vh)" : "min(560px, 70vh)"}),
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
                    Чат по этапу
                </div>
            ) : null}

            <p style={{
                margin: 0,
                padding: inDrawer ? "10px 14px 0" : "8px 14px 0",
                fontSize: "0.72rem",
                color: "var(--dash-muted)",
                lineHeight: 1.45,
                flexShrink: 0
            }}>
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
                    messages.map(m => {
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

            {error && (
                <div style={{padding: "0 12px", fontSize: "0.72rem", color: "var(--dash-danger)"}}>{error}</div>
            )}

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
                <div style={{display: "flex", alignItems: "flex-end", gap: 8, width: "100%", minWidth: 0}}>
        <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Сообщение…"
            rows={compact ? 3 : inDrawer ? 6 : 4}
            disabled={sending}
            style={{
                width: "100%",
                flex: 1,
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                resize: inDrawer ? "none" : "vertical",
                minHeight: compact ? 60 : inDrawer ? 120 : 80,
                maxHeight: inDrawer ? "min(48vh, 280px)" : compact ? 140 : 220,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--dash-border)",
                background: "var(--dash-bg)",
                color: "var(--dash-text)",
                fontFamily: "inherit",
                fontSize: "0.82rem",
            }}
            onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void send()
                }
            }}
        />
                <ChatEmojiPicker disabled={sending} onSelect={insertEmoji}/>
                    <button
                        type="button"
                        aria-label="Отправить сообщение"
                        title="Отправить сообщение"
                        onClick={() => void send()}
                        disabled={sending || !draft.trim()}
                        style={{
                            width: 34,
                            height: 34,
                            padding: 0,
                            borderRadius: 8,
                            border: "none",
                            background: draft.trim() ? "var(--dash-accent)" : "var(--dash-border)",
                            color: "#fff",
                            cursor: draft.trim() && !sending ? "pointer" : "default",
                            opacity: sending ? 0.75 : 1,
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <i className={sending ? "bx bx-loader-alt bx-spin" : "bx bx-send"} style={{fontSize: "1.15rem"}} aria-hidden/>
                    </button>
                </div>
                {viewerRole === "CLIENT" && aiAssist ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            minWidth: 0,
                        }}
                    >
                        <div style={{minWidth: 0, flex: inDrawer ? "1 1 auto" : undefined}}>
                            <StageChatAiAssist
                                orderId={aiAssist.orderId}
                                stageId={aiAssist.stageId}
                                draft={draft}
                                onInsert={text =>
                                    setDraft(prev => {
                                        const p = prev.trim()
                                        return p ? `${p}\n\n${text}` : text
                                    })
                                }
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
})

StageChatPanel.displayName = "StageChatPanel"
