"use client"
import {useCallback, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import {ActionButton, AppModal, SectionLabel} from "@/components/app/AppCard"
import {DashCarousel} from "@/components/dashboard-ui/DashCarousel"
import {ConfirmDialog} from "./ConfirmDialog"

const DESC_MAX = 500

// ─── Утилита: извлечь готовое описание из блока ---\n...\n--- ───────────────
function extractReady(text: string): string | null {
    const m = text.match(/---\n([\s\S]+?)\n---/)
    return m ? m[1].trim() : null
}

// ─── Чат-дравер AI ────────────────────────────────────────────────────────────
interface ChatMessage {
    role: "user" | "assistant";
    content: string
}

function AiChatDrawer({
                          open, onClose, title, currentDescription, onApply,
                      }: {
    open: boolean
    onClose: () => void
    title: string
    currentDescription: string
    onApply: (text: string) => void
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Открываем → сразу получаем первое сообщение AI
    useEffect(() => {
        if (!open) return
        setMessages([])
        setInput("")
        setError(null)
        sendToAI([])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: "smooth"})
    }, [messages, loading])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        if (open) window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    const sendToAI = async (msgs: ChatMessage[]) => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/ai/portfolio-chat", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({messages: msgs, title, currentDescription}),
            })
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setMessages(prev => [...prev, {role: "assistant", content: json.reply}])
        } catch {
            setError("AI временно недоступен")
        } finally {
            setLoading(false)
        }
    }

    const send = () => {
        const text = input.trim()
        if (!text || loading) return
        const next: ChatMessage[] = [...messages, {role: "user", content: text}]
        setMessages(next)
        setInput("")
        sendToAI(next)
    }

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])
    if (!mounted) return null

    return createPortal(
        <div style={{
            position: "fixed",
            inset: 0,
            overflow: "hidden",
            pointerEvents: open ? "auto" : "none",
            zIndex: 50
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
                    opacity: open ? 1 : 0, transition: "opacity 0.3s ease",
                }}
            />

            {/* Панель */}
            <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0,
                width: "min(420px, 94vw)",
                background: "#0d1230",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
                transform: open ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
            }}>

                {/* Шапка */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1.1rem 1.4rem",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    flexShrink: 0
                }}>
                    <div style={{display: "flex", alignItems: "center", gap: "0.5em"}}>
                        <span style={{fontSize: "1rem"}}>✨</span>
                        <span style={{color: "#f4f4f4", fontSize: "0.92rem", fontWeight: 500}}>AI-помощник</span>
                        <span style={{
                            background: "rgba(121,40,202,0.25)",
                            borderRadius: 100,
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            padding: "0.2em 0.6em",
                            textTransform: "uppercase"
                        }}>
              описание
            </span>
                    </div>
                    <button onClick={onClose} style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        color: "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        padding: "0.3em 0.55em"
                    }}>✕
                    </button>
                </div>

                {/* Сообщения */}
                <div style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "1rem 1.4rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem"
                }}>
                    {messages.map((m, i) => {
                        const isUser = m.role === "user"
                        const ready = !isUser ? extractReady(m.content) : null
                        // Текст без блока ---...---
                        const displayText = m.content.replace(/---\n[\s\S]+?\n---/, "").trim()

                        return (
                            <div key={i} style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: isUser ? "flex-end" : "flex-start",
                                gap: "0.3rem"
                            }}>
                                <div style={{
                                    background: isUser ? "rgba(121,40,202,0.22)" : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${isUser ? "rgba(121,40,202,0.3)" : "rgba(255,255,255,0.08)"}`,
                                    borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                                    color: isUser ? "rgba(255,255,255,0.85)" : "#e8e8f0",
                                    fontSize: "0.85rem",
                                    lineHeight: 1.55,
                                    maxWidth: "88%",
                                    padding: "0.65rem 0.9rem",
                                    whiteSpace: "pre-wrap",
                                }}>
                                    {displayText}
                                </div>

                                {/* Готовое описание */}
                                {ready && (
                                    <div style={{maxWidth: "88%", width: "100%"}}>
                                        <div style={{
                                            background: "rgba(52,211,153,0.06)",
                                            border: "1px solid rgba(52,211,153,0.2)",
                                            borderRadius: 8,
                                            padding: "0.65rem 0.9rem",
                                            marginBottom: "0.4rem"
                                        }}>
                                            <div style={{
                                                color: "rgba(52,211,153,0.7)",
                                                fontSize: "0.65rem",
                                                fontWeight: 600,
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                                marginBottom: "0.35rem"
                                            }}>Готовое описание
                                            </div>
                                            <p style={{
                                                color: "#e8e8f0",
                                                fontSize: "0.83rem",
                                                lineHeight: 1.5,
                                                margin: 0,
                                                whiteSpace: "pre-wrap"
                                            }}>{ready}</p>
                                            <div style={{
                                                color: "rgba(255,255,255,0.25)",
                                                fontSize: "0.7rem",
                                                marginTop: "0.35rem"
                                            }}>{ready.length} / 500 символов
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                onApply(ready.slice(0, DESC_MAX));
                                                onClose()
                                            }}
                                            style={{
                                                background: "rgba(52,211,153,0.15)",
                                                border: "1px solid rgba(52,211,153,0.3)",
                                                borderRadius: 6,
                                                color: "rgba(52,211,153,0.9)",
                                                cursor: "pointer",
                                                fontSize: "0.8rem",
                                                fontFamily: "inherit",
                                                fontWeight: 500,
                                                padding: "0.4em 0.9em"
                                            }}
                                        >
                                            Применить →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {loading && (
                        <div style={{display: "flex", gap: "0.3rem", padding: "0.5rem 0"}}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "rgba(255,255,255,0.3)",
                                    animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`
                                }}/>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div style={{
                            background: "rgba(240,20,20,0.07)",
                            border: "1px solid rgba(240,20,20,0.2)",
                            borderRadius: 8,
                            color: "rgba(255,100,100,0.8)",
                            fontSize: "0.83rem",
                            padding: "0.7rem 0.9rem"
                        }}>
                            {error}
                        </div>
                    )}

                    <div ref={bottomRef}/>
                </div>

                {/* Ввод */}
                <div style={{borderTop: "1px solid rgba(255,255,255,0.07)", padding: "0.9rem 1.4rem", flexShrink: 0}}>
                    <div style={{display: "flex", gap: "0.5rem", alignItems: "flex-end"}}>
            <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send()
                    }
                }}
                placeholder="Напишите ответ… (Enter — отправить)"
                disabled={loading}
                style={{
                    flex: 1, resize: "none",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "#f4f4f4",
                    fontSize: "0.85rem", fontFamily: "inherit",
                    padding: "0.6em 0.8em", outline: "none",
                    lineHeight: 1.5,
                }}
            />
                        <button
                            onClick={send}
                            disabled={!input.trim() || loading}
                            style={{
                                background: "rgba(121,40,202,0.4)",
                                border: "1px solid rgba(121,40,202,0.5)",
                                borderRadius: 8, color: "#fff",
                                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                                fontSize: "1rem", padding: "0.55em 0.75em",
                                opacity: !input.trim() || loading ? 0.5 : 1,
                                transition: "opacity 0.15s",
                            }}
                            aria-label="Отправить"
                        >
                            ↑
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0) }
          40% { transform: translateY(-6px) }
        }
      `}</style>
        </div>,
        document.body
    )
}

// ─── Типы ────────────────────────────────────────────────────────────────────

type Tab = "PORTFOLIO" | "DOCUMENT"
type View = "grid" | "list"

interface UserFile {
    id: string
    filename: string
    title: string | null
    description: string | null
    mimeType: string | null
    size: number | null
    createdAt: string
}

const TABS: { id: Tab; label: string; icon: string; accept: string; hint: string }[] = [
    {
        id: "PORTFOLIO",
        label: "Фото и рендеры",
        icon: "bx-image-alt",
        accept: ".jpg,.jpeg,.png",
        hint: "JPG, PNG · до 500 МБ"
    },
    {
        id: "DOCUMENT",
        label: "Материалы",
        icon: "bx-file",
        accept: ".pdf,.dwg,.dxf,.zip",
        hint: "PDF, DWG, DXF, ZIP · до 500 МБ"
    },
]

const isImage = (f: UserFile) =>
    f.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(f.filename)

const isFileImage = (f: File) =>
    f.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(f.name)

const fmt = (bytes: number | null) => {
    if (!bytes) return ""
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

// ─── Модальное превью (уже загруженные файлы) ─────────────────────────────────

function PreviewModal({file, url, onClose, onSave}: {
    file: UserFile; url: string
    onClose: () => void
    onSave: (id: string, title: string, description: string) => Promise<void>
}) {
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(file.title ?? "")
    const [description, setDescription] = useState(file.description ?? "")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        await onSave(file.id, title, description)
        setSaving(false)
        setEditing(false)
    }

    return (
        <AppModal open onClose={onClose} maxWidth={960}>
            {isImage(file) && (
                <div style={{
                    background: "#111",
                    maxHeight: "55vh",
                    overflow: "hidden",
                    borderRadius: "16px 16px 0 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={file.title ?? file.filename}
                         style={{maxWidth: "100%", maxHeight: "55vh", objectFit: "contain"}}/>
                </div>
            )}
            <div style={{padding: "20px 24px 24px"}}>
                <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                    <div style={{flex: 1, minWidth: 0}}>
                        {editing
                            ? <input className="form-control fw-semibold mb-1" style={{fontSize: 17}} value={title}
                                     onChange={e => setTitle(e.target.value)} placeholder="Название работы" autoFocus/>
                            :
                            <h5 className="mb-0 fw-semibold" style={{fontSize: 17}}>{file.title || file.filename}</h5>}
                        <small
                            className="text-muted">{fmt(file.size)}{file.size ? " · " : ""}{new Date(file.createdAt).toLocaleDateString("ru-RU")}</small>
                    </div>
                    <div className="d-flex gap-2 flex-shrink-0 align-items-center">
                        {!editing &&
                            <ActionButton icon="bx-edit" onClick={() => setEditing(true)}>Изменить</ActionButton>}
                        <ActionButton icon="bx-link-external"
                                      onClick={() => window.open(url, "_blank")}>Открыть</ActionButton>
                        <button className="btn btn-sm btn-outline-secondary px-2" onClick={onClose}><i
                            className="bx bx-x" style={{fontSize: 18}}/></button>
                    </div>
                </div>
                <div>
                    <SectionLabel>Описание</SectionLabel>
                    {editing
                        ? <textarea className="form-control" rows={3} value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Объект, стиль, площадь, использованные решения…"/>
                        : <p className="text-muted mb-0" style={{fontSize: "0.9rem", whiteSpace: "pre-wrap"}}>
                            {file.description || <span style={{opacity: 0.45}}>Описание не добавлено</span>}
                        </p>}
                </div>
                {editing && (
                    <div className="d-flex gap-2 mt-3">
                        <ActionButton variant="primary" icon="bx-check" onClick={handleSave}
                                      disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</ActionButton>
                        <ActionButton onClick={() => {
                            setEditing(false);
                            setTitle(file.title ?? "");
                            setDescription(file.description ?? "")
                        }}>Отмена</ActionButton>
                    </div>
                )}
            </div>
        </AppModal>
    )
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export default function PortfolioUploader() {
    const [tab, setTab] = useState<Tab>("PORTFOLIO")
    const [view, setView] = useState<View>("grid")
    const [files, setFiles] = useState<UserFile[]>([])
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

    // ── Состояние ожидающего файла ──
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [pendingPreview, setPendingPreview] = useState<string | null>(null)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")

    // ── Процесс загрузки ──
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)

    // ── Модальное окно ──
    const [modalFile, setModalFile] = useState<UserFile | null>(null)
    const [modalUrl, setModalUrl] = useState<string>("")

    // ── AI дравер ──
    const [drawerOpen, setDrawerOpen] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const currentTab = TABS.find(t => t.id === tab)!

    // ─── Загрузка списка ──────────────────────────────────────────────────────

    const loadFiles = useCallback(async (category: Tab) => {
        try {
            const res = await fetch(`/api/files?category=${category}`)
            if (!res.ok) throw new Error(`Не удалось загрузить файлы (${res.status})`)
            const data = await res.json()
            if (!Array.isArray(data)) return
            setFiles(data)

            const images = data.filter(isImage)
            const entries = await Promise.all(
                images.map(async (f: UserFile) => {
                    try {
                        const urlRes = await fetch(`/api/files/${f.id}/url`)
                        if (!urlRes.ok) return [f.id, ""] as [string, string]
                        const {url} = await urlRes.json()
                        return [f.id, url ?? ""] as [string, string]
                    } catch {
                        return [f.id, ""] as [string, string]
                    }
                })
            )
            setPreviewUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))))
            setError(null)
        } catch (e) {
            // Network / transient API failures should not crash the page.
            setError((e as Error).message || "Не удалось загрузить файлы")
            setFiles([])
            setPreviewUrls({})
        }
    }, [])

    useEffect(() => {
        setFiles([])
        setPreviewUrls({})
        loadFiles(tab)
    }, [tab, loadFiles])

    // ─── Выбор файла (без загрузки) ───────────────────────────────────────────

    const selectFile = (file: File) => {
        setPendingFile(file)
        setTitle(file.name.replace(/\.[^.]+$/, ""))
        setDescription("")
        setError(null)
        setDrawerOpen(false)

        if (isFileImage(file)) {
            const url = URL.createObjectURL(file)
            setPendingPreview(url)
        } else {
            setPendingPreview(null)
        }
    }

    const clearPending = () => {
        if (pendingPreview) URL.revokeObjectURL(pendingPreview)
        setPendingFile(null)
        setPendingPreview(null)
        setTitle("")
        setDescription("")
        setError(null)
        setDrawerOpen(false)
        if (inputRef.current) inputRef.current.value = ""
    }

    // ─── Загрузка файла ───────────────────────────────────────────────────────

    const uploadPending = async () => {
        if (!pendingFile) return
        setUploading(true)
        setProgress(0)
        setError(null)
        try {
            // 1. Получаем presigned URL и создаем запись в БД
            const res = await fetch("/api/files", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    filename: pendingFile.name,
                    mimeType: pendingFile.type || "application/octet-stream",
                    size: pendingFile.size,
                    category: tab,
                    title: title || pendingFile.name,
                    description: description || null,
                }),
            })
            const resText = await res.text()
            let resJson: { uploadUrl?: string; file?: UserFile; error?: string }
            try {
                resJson = JSON.parse(resText)
            } catch {
                throw new Error(`Ошибка сервера: ${resText.slice(0, 120)}`)
            }
            if (!res.ok) throw new Error(resJson.error ?? `Ошибка ${res.status}`)
            const {file: saved} = resJson as { file: UserFile }

            // 2. Загружаем через backend, чтобы не зависеть от CORS браузера на S3
            const putRes = await fetch(`/api/files/${saved.id}/upload`, {
                method: "PUT",
                body: pendingFile,
                headers: {"Content-Type": pendingFile.type || "application/octet-stream"},
            })
            if (!putRes.ok) throw new Error(`Upload ошибка: ${putRes.status}`)
            setProgress(100)

            // 3. Подгружаем превью если картинка
            if (isImage(saved)) {
                const urlRes = await fetch(`/api/files/${saved.id}/url`)
                const urlText = await urlRes.text()
                try {
                    const {url} = JSON.parse(urlText)
                    if (url) setPreviewUrls(prev => ({...prev, [saved.id]: url}))
                } catch { /* превью не критично */
                }
            }

            setFiles(prev => [saved, ...prev])
            clearPending()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setUploading(false)
            setProgress(0)
        }
    }

    // ─── Удаление ─────────────────────────────────────────────────────────────

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const deleteFile = async (id: string) => {
        await fetch(`/api/files/${id}`, {method: "DELETE"})
        setFiles(prev => prev.filter(f => f.id !== id))
        setPreviewUrls(prev => {
            const n = {...prev};
            delete n[id];
            return n
        })
        if (modalFile?.id === id) {
            setModalFile(null)
            setModalUrl("")
        }
        setConfirmDeleteId(null)
    }

    // ─── Открыть превью ──────────────────────────────────────────────────────

    const openPreview = async (file: UserFile) => {
        if (!isImage(file)) {
            const url = previewUrls[file.id] ?? await fetch(`/api/files/${file.id}/url`).then(r => r.json()).then(d => d.url)
            window.open(url, "_blank")
            return
        }
        let url = previewUrls[file.id] ?? ""
        if (!url) {
            const body = await fetch(`/api/files/${file.id}/url`).then(r => r.json())
            url = body?.url ?? ""
            if (url) setPreviewUrls(prev => ({...prev, [file.id]: url}))
        }
        if (!url) return
        setModalUrl(url)
        setModalFile(file)
    }

    // ─── Сохранить meta ───────────────────────────────────────────────────────

    const saveFileMeta = async (id: string, newTitle: string, newDescription: string) => {
        const res = await fetch(`/api/files/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({title: newTitle, description: newDescription}),
        })
        const updated: UserFile = await res.json()
        setFiles(prev => prev.map(f => f.id === id ? updated : f))
        if (modalFile?.id === id) setModalFile(updated)
    }

    // ─── Drag & Drop ──────────────────────────────────────────────────────────

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) selectFile(file)
    }

    // ─── Рендер плитки файла в сетке ───────────────────────────────────────────

    const renderFile = (f: UserFile) => {
        const preview = previewUrls[f.id]
        const img = isImage(f)
        const isList = view === "list"

        return (
            <div key={f.id} className={isList ? "col-12" : "col-sm-6 col-xl-4"}>
                <div
                    className="up-card"
                    style={{
                        padding: 0, overflow: "hidden", cursor: "pointer", margin: 0,
                        display: isList ? "flex" : "block", alignItems: isList ? "center" : undefined
                    }}
                    onClick={() => openPreview(f)}
                >
                    {/* Превью/иконка */}
                    {(!isList && img) ? (
                        <div style={{
                            height: 180,
                            overflow: "hidden",
                            background: "rgba(91,79,207,0.06)",
                            position: "relative"
                        }}>
                            {preview
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={preview} alt={f.title ?? f.filename}
                                       style={{width: "100%", height: "100%", objectFit: "cover"}}/>
                                : <div className="d-flex align-items-center justify-content-center h-100"><i
                                    className="bx bx-image text-muted" style={{fontSize: 48}}/></div>}
                            <div className="portfolio-overlay"><i className="bx bx-zoom-in"
                                                                  style={{fontSize: 28, color: "#fff"}}/></div>
                        </div>
                    ) : (
                        <div style={{
                            width: isList ? 44 : 48, height: isList ? 44 : 48, flexShrink: 0,
                            background: img ? "rgba(91,79,207,0.06)" : "rgba(91,79,207,0.08)",
                            borderRadius: isList ? "8px 0 0 8px" : 8,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: isList ? 0 : "16px 16px 0",
                        }}>
                            {img && preview
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={preview} alt="" style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: isList ? "8px 0 0 8px" : 8
                                }}/>
                                : <i className={`bx ${img ? "bx-image" : "bx-file"} text-primary`}
                                     style={{fontSize: 20}}/>}
                        </div>
                    )}

                    {/* Мета */}
                    <div style={{padding: isList ? "10px 12px" : "10px 14px 12px", flex: 1, minWidth: 0}}>
                        <div className="d-flex align-items-start justify-content-between gap-2">
                            <div style={{minWidth: 0}}>
                                <p className="fw-semibold mb-0 small text-truncate">{f.title || f.filename}</p>
                                {f.description && (
                                    <p className="text-muted mb-0" style={{
                                        fontSize: "0.78rem",
                                        display: "-webkit-box",
                                        WebkitLineClamp: isList ? 1 : 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden"
                                    }}>
                                        {f.description}
                                    </p>
                                )}
                                <small className="text-muted" style={{fontSize: "0.75rem"}}>
                                    {fmt(f.size)}{f.size ? " · " : ""}{new Date(f.createdAt).toLocaleDateString("ru-RU")}
                                </small>
                            </div>
                            <div className="d-flex gap-1 flex-shrink-0">
                                <button className="up-icon-btn" onClick={e => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(f.id)
                                }} aria-label="Удалить">
                                    <i className="bx bx-trash text-danger"/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderCarouselFile = (f: UserFile) => {
        const preview = previewUrls[f.id]
        return (
            <div key={f.id} className="pf-carousel__item">
                <div
                    className="pf-carousel__card"
                    onClick={() => openPreview(f)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            void openPreview(f)
                        }
                    }}
                >
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt={f.title ?? f.filename} className="pf-carousel__img"/>
                    ) : (
                        <div className="pf-carousel__empty"><i className="bx bx-image"/></div>
                    )}
                    <div className="pf-carousel__overlay">
                        <p className="pf-carousel__title">{f.title || f.filename}</p>
                        {f.description && <p className="pf-carousel__desc">{f.description}</p>}
                        <div className="pf-carousel__actions">
                            <button className="up-icon-btn" onClick={e => {
                                e.stopPropagation();
                                void setConfirmDeleteId(f.id)
                            }} aria-label="Удалить">
                                <i className="bx bx-trash text-danger"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Рендер ───────────────────────────────────────────────────────────────

    return (
        <div>
            {/* ── Табы: тип загружаемых файлов ── */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex gap-2">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => {
                            setTab(t.id);
                            clearPending()
                        }}
                                className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-outline-secondary"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pf-upload-block">
                <div className="d-flex align-items-center gap-2 mb-3">
          <span className="fw-semibold small" style={{color: "var(--dash-text, #201d1d)"}}>
            Загрузка
          </span>
                </div>
                <div className="card mb-0" style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "none",
                    background: "rgba(20,25,40,0.28)"
                }}>
                    <div className="card-body p-3" style={{background: "transparent"}}>
                        <div className="row g-3 align-items-stretch">
                            <div className="col-md-5">
                                {pendingFile ? (
                                    <div style={{
                                        position: "relative",
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        height: "100%",
                                        minHeight: 140,
                                        background: "rgba(91,79,207,0.04)",
                                        border: "1px solid rgba(255,255,255,0.08)"
                                    }}>
                                        {pendingPreview ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={pendingPreview} alt="preview" style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block"
                                            }}/>
                                        ) : (
                                            <div
                                                className="d-flex flex-column align-items-center justify-content-center h-100 gap-2 p-3">
                                                <i className="bx bx-file text-primary" style={{fontSize: 36}}/>
                                                <p className="mb-0 small fw-medium text-truncate text-center"
                                                   style={{maxWidth: "90%"}}>{pendingFile.name}</p>
                                                <small className="text-muted">{fmt(pendingFile.size)}</small>
                                            </div>
                                        )}
                                        {!uploading && (
                                            <button onClick={clearPending} style={{
                                                position: "absolute",
                                                top: 6,
                                                right: 6,
                                                width: 26,
                                                height: 26,
                                                borderRadius: "50%",
                                                border: "none",
                                                background: "rgba(0,0,0,0.55)",
                                                color: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                cursor: "pointer",
                                                fontSize: 14
                                            }} aria-label="Отменить выбор">
                                                <i className="bx bx-x"/>
                                            </button>
                                        )}
                                        {uploading && (
                                            <div style={{
                                                position: "absolute",
                                                inset: 0,
                                                background: "rgba(0,0,0,0.5)",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 8
                                            }}>
                                                <i className="bx bx-loader-alt bx-spin"
                                                   style={{fontSize: 28, color: "#fff"}}/>
                                                <div style={{width: "70%"}}>
                                                    <div className="progress" style={{
                                                        height: 4,
                                                        borderRadius: 10,
                                                        background: "rgba(255,255,255,0.2)"
                                                    }}>
                                                        <div className="progress-bar" style={{
                                                            width: `${progress}%`,
                                                            background: "#fff",
                                                            transition: "width 0.2s"
                                                        }}/>
                                                    </div>
                                                    <small style={{color: "#fff", opacity: 0.85}}>{progress}%</small>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        onDragOver={e => {
                                            e.preventDefault();
                                            setDragging(true)
                                        }}
                                        onDragLeave={() => setDragging(false)}
                                        onDrop={onDrop}
                                        onClick={() => inputRef.current?.click()}
                                        style={{
                                            border: `1px dashed ${dragging ? "rgba(91,79,207,0.58)" : "rgba(255,255,255,0.12)"}`,
                                            borderRadius: 10,
                                            height: "100%",
                                            minHeight: 140,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 6,
                                            background: dragging ? "var(--dash-accent-bg, rgba(91,79,207,0.04))" : "var(--dash-surface2, rgba(32,29,29,0.015))",
                                            cursor: "pointer",
                                            transition: "border-color 0.2s, background 0.2s",
                                            textAlign: "center",
                                            padding: "1rem",
                                        }}
                                    >
                                        <i className={`bx bx-cloud-upload ${dragging ? "text-primary" : "text-muted"}`}
                                           style={{fontSize: 30}}/>
                                        <p className="mb-0 fw-medium small"
                                           style={{color: dragging ? "var(--dash-accent, var(--bs-primary))" : "var(--dash-text, #201d1d)"}}>
                                            {dragging ? "Отпустите для выбора" : "Перетащите файл или нажмите"}
                                        </p>
                                        <small className="text-muted">{currentTab.hint}</small>
                                    </div>
                                )}
                                <input ref={inputRef} type="file" accept={currentTab.accept} className="d-none"
                                       onChange={e => e.target.files?.[0] && selectFile(e.target.files[0])}/>
                            </div>

                            <div className="col-md-7 d-flex flex-column gap-2">
                                <div>
                                    <label className="form-label small fw-medium mb-1">Название работы</label>
                                    <input className="form-control form-control-sm"
                                           placeholder="Офис на ул. Ленина, 80 м²" value={title}
                                           onChange={e => setTitle(e.target.value)}
                                           disabled={uploading || !pendingFile}/>
                                </div>
                                <div className="flex-grow-1 d-flex flex-column">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <label className="form-label small fw-medium mb-0">Описание <span
                                            className="text-muted fw-normal"
                                            style={{fontSize: "0.73rem"}}>(необязательно)</span></label>
                                        <small className="text-muted"
                                               style={{fontSize: "0.7rem"}}>{description.length} / {DESC_MAX}</small>
                                    </div>
                                    <textarea className="form-control form-control-sm flex-grow-1" rows={3}
                                              maxLength={DESC_MAX}
                                              placeholder={pendingFile ? "Стиль, площадь, особенности проекта…" : "Сначала выберите файл"}
                                              value={description}
                                              onChange={e => setDescription(e.target.value.slice(0, DESC_MAX))}
                                              disabled={uploading || !pendingFile} style={{resize: "none"}}/>
                                </div>
                                <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                                    <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                                            onClick={uploadPending} disabled={!pendingFile || uploading}
                                            style={{minWidth: 120}}>
                                        {uploading ? <><i className="bx bx-loader-alt bx-spin"/>Загрузка…</> : <><i
                                            className="bx bx-upload"/>Загрузить</>}
                                    </button>
                                    <button type="button" className="btn btn-sm d-flex align-items-center gap-1"
                                            style={{
                                                fontSize: "0.8rem",
                                                padding: "0.3rem 0.65rem",
                                                background: "rgba(91,79,207,0.06)",
                                                border: "1px solid rgba(91,79,207,0.25)",
                                                borderRadius: 6,
                                                color: "#5b4fcf",
                                                whiteSpace: "nowrap"
                                            }} onClick={() => setDrawerOpen(true)} disabled={uploading || !pendingFile}
                                            title="Составить описание с помощью AI">
                                        <span style={{fontSize: "0.85rem"}}>✨</span> AI описание
                                    </button>
                                    {error && <small className="text-danger">{error}</small>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pf-gallery-block">
                <div className="pf-gallery-block__inner">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <span className="fw-semibold small" style={{color: "var(--dash-text, #201d1d)"}}>
              {tab === "PORTFOLIO" ? "Загруженные работы" : "Загруженные материалы"}
            </span>
                        <div className="d-flex align-items-center gap-2">
                            {files.length > 0 && <span className="badge bg-label-secondary"
                                                       style={{fontSize: "0.7rem"}}>{files.length}</span>}
                            {tab === "PORTFOLIO" && files.length > 0 && (
                                <div className="btn-group btn-group-sm">
                                    <button
                                        className={`btn ${view === "grid" ? "btn-primary" : "btn-outline-secondary"}`}
                                        onClick={() => setView("grid")} title="Блок">
                                        <i className="bx bx-grid-alt"/>
                                    </button>
                                    <button
                                        className={`btn ${view === "list" ? "btn-primary" : "btn-outline-secondary"}`}
                                        onClick={() => setView("list")} title="Списком">
                                        <i className="bx bx-list-ul"/>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {files.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <p className="mb-0">{tab === "PORTFOLIO" ? "Здесь появятся загруженные фото и рендеры" : "Здесь появятся загруженные материалы"}</p>
                        </div>
                    ) : tab === "PORTFOLIO" && view === "grid" ? (
                        <div className="pf-carousel-wrap">
                            <DashCarousel ariaLabel="Карусель портфолио" viewportClassName="pf-carousel">
                                {files.filter(isImage).map(renderCarouselFile)}
                            </DashCarousel>
                        </div>
                    ) : (
                        <div className="row g-3">{files.map(renderFile)}</div>
                    )}
                </div>
            </div>

            {/* ── Модальное превью ── */}
            {modalFile && modalUrl && (
                <PreviewModal file={modalFile} url={modalUrl} onClose={() => {
                    setModalFile(null);
                    setModalUrl("")
                }} onSave={saveFileMeta}/>
            )}

            {/* ── AI чат-дравер ── */}
            <AiChatDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={title}
                currentDescription={description}
                onApply={text => setDescription(text.slice(0, DESC_MAX))}
            />

            {/* ── Confirm delete ── */}
            <ConfirmDialog
                open={!!confirmDeleteId}
                title="Удалить файл?"
                message="Файл будет удален без возможности восстановления."
                onConfirm={() => confirmDeleteId && deleteFile(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <style>{`
        .pf-upload-block { margin-bottom: 14px; }
        .pf-gallery-block__inner {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          background: rgba(20,25,40,0.22);
          padding: 12px;
          min-height: 540px;
        }
        .pf-carousel-wrap { position: relative; }
        .pf-carousel__item { flex: 0 0 120px; transition: 0.5s ease-in-out; scroll-snap-align: start; }
        .pf-carousel__item:hover { flex: 0 0 250px; transform: translateY(-18px); }
        .pf-carousel__card {
          height: 500px;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(91,79,207,0.06);
          box-shadow: 1px 3px 15px rgba(0,0,0,0.28);
        }
        .pf-carousel__img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .pf-carousel__empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--dash-muted); font-size: 30px; }
        .pf-carousel__overlay {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; justify-content: flex-end;
          align-items: flex-start;
          padding: 10px;
          background: linear-gradient(0deg, rgba(2,2,46,0.68) 0%, rgba(255,255,255,0) 100%);
          opacity: 0;
          visibility: hidden;
          transform: translateY(100%);
          transition: opacity 0.5s ease-in-out, transform 0.5s 0.2s, visibility 0.5s ease-in-out;
        }
        .pf-carousel__card:hover .pf-carousel__overlay { opacity: 1; visibility: visible; transform: translateY(0%); }
        .pf-carousel__title { margin: 0; color: #fff; font-size: 0.78rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pf-carousel__desc { margin: 2px 0 6px; color: rgba(255,255,255,0.75); font-size: 0.7rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .pf-carousel__actions { display: flex; gap: 6px; }
        .portfolio-overlay {
          position: absolute; inset: 0; opacity: 0;
          background: rgba(0,0,0,0);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s, opacity 0.2s;
        }
        .up-card:hover .portfolio-overlay { background: rgba(0,0,0,0.38); opacity: 1; }
      `}</style>
        </div>
    )
}
