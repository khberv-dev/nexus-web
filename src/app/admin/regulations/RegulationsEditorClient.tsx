"use client"

import {useMemo, useState} from "react"
import {toast} from "sonner"
import {Markdown} from "@/components/ui/Markdown"
import type {RegulationsDocument} from "@/lib/regulations"

type Tab = "edit" | "preview"

export default function RegulationsEditorClient({
                                                    document,
                                                    defaultContent,
                                                }: {
    document: RegulationsDocument
    defaultContent: string
}) {
    const [title, setTitle] = useState(document.title)
    const [content, setContent] = useState(document.content)
    const [savedTitle, setSavedTitle] = useState(document.title)
    const [savedContent, setSavedContent] = useState(document.content)
    const [updatedAt, setUpdatedAt] = useState(document.updatedAt)
    const [isDefault, setIsDefault] = useState(document.isDefault)
    const [tab, setTab] = useState<Tab>("edit")
    const [saving, setSaving] = useState(false)

    const dirty = title !== savedTitle || content !== savedContent
    const stats = useMemo(() => {
        const chars = content.length
        return {chars, pages: Math.max(1, Math.round(chars / 1800))}
    }, [content])

    const save = async () => {
        if (saving || !content.trim()) return
        setSaving(true)
        try {
            const res = await fetch("/api/admin/regulations", {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({title, content}),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Не удалось сохранить регламент")
            setSavedTitle(title)
            setSavedContent(content)
            setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString())
            setIsDefault(false)
            toast.success("Регламент сохранён. Специалисты увидят новую версию сразу.")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Не удалось сохранить регламент")
        } finally {
            setSaving(false)
        }
    }

    const restoreDefault = () => {
        if (!confirm("Подставить исходный текст регламента из кода? Изменения в редакторе будут потеряны (сохранение — отдельной кнопкой).")) return
        setContent(defaultContent)
        setTab("edit")
    }

    return (
        <div style={{display: "flex", flexDirection: "column", gap: 16}}>
            <div className="d-flex align-items-center justify-content-between" style={{flexWrap: "wrap", gap: 12}}>
                <div>
                    <h5 className="mb-0 fw-semibold">Регламент платформы</h5>
                    <div className="text-muted" style={{fontSize: "0.8rem", marginTop: 4}}>
                        Текст шага онбординга «Ознакомление с регламентом». Поддерживается markdown.
                    </div>
                </div>
                <div className="d-flex gap-2" style={{alignItems: "center"}}>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={restoreDefault}>
                        <i className="bx bx-revision" style={{marginRight: 4}}/>
                        Текст по умолчанию
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={save}
                        disabled={saving || !dirty || !content.trim()}
                    >
                        {saving ? "Сохранение…" : dirty ? "Сохранить" : "Сохранено"}
                    </button>
                </div>
            </div>

            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                fontSize: "0.78rem",
                color: "var(--adm-muted)",
            }}>
                <span>
                    <i className="bx bx-time-five" style={{marginRight: 4}}/>
                    {isDefault
                        ? "Показывается текст по умолчанию из кода — правки ещё не сохранялись"
                        : `Обновлено: ${updatedAt ? new Date(updatedAt).toLocaleString("ru-RU") : "—"}${document.updatedBy ? ` · ${document.updatedBy}` : ""}`}
                </span>
                <span>· {stats.chars.toLocaleString("ru-RU")} символов (~{stats.pages} стр.)</span>
                {dirty && <span style={{color: "#f59e0b"}}>· есть несохранённые изменения</span>}
            </div>

            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between"
                     style={{gap: 12, flexWrap: "wrap"}}>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Заголовок документа"
                        className="form-control"
                        style={{maxWidth: 420, fontSize: "0.88rem"}}
                    />
                    <div className="d-flex gap-1">
                        {([["edit", "Редактор"], ["preview", "Предпросмотр"]] as [Tab, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => setTab(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card-body">
                    {tab === "edit" ? (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            spellCheck={false}
                            style={{
                                width: "100%",
                                minHeight: "62vh",
                                boxSizing: "border-box",
                                padding: "0.9rem 1rem",
                                borderRadius: 8,
                                border: "1px solid var(--adm-sidebar-border, #e5e7eb)",
                                background: "var(--adm-outer, #f9fafb)",
                                color: "var(--adm-text, #111827)",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                fontSize: "0.82rem",
                                lineHeight: 1.6,
                                resize: "vertical",
                                outline: "none",
                            }}
                        />
                    ) : (
                        <div style={{
                            maxHeight: "62vh",
                            overflowY: "auto",
                            padding: "0.9rem 1rem",
                            borderRadius: 8,
                            border: "1px solid var(--adm-sidebar-border, #e5e7eb)",
                            background: "var(--adm-sidebar, #fff)",
                            color: "var(--adm-text, #111827)",
                        }}>
                            <Markdown content={content}/>
                        </div>
                    )}

                    <div className="text-muted" style={{fontSize: "0.75rem", marginTop: 10, lineHeight: 1.5}}>
                        <i className="bx bx-markdown" style={{marginRight: 4}}/>
                        Разметка: <code>## Заголовок</code>, <code>**жирный**</code>, <code>- список</code>,
                        <code>[ссылка](https://…)</code>, таблицы GFM. Заголовки второго уровня разбивают
                        регламент на разделы в интерфейсе специалиста.
                    </div>
                </div>
            </div>
        </div>
    )
}
