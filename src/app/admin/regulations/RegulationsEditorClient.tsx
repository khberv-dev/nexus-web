"use client"

import {useState} from "react"
import {toast} from "sonner"
import type {RegulationsDocument} from "@/lib/regulations"
import {RegulationsRichEditor} from "./RegulationsRichEditor"

export default function RegulationsEditorClient({document}: { document: RegulationsDocument }) {
    const [title, setTitle] = useState(document.title)
    const [content, setContent] = useState(document.content)
    const [savedTitle, setSavedTitle] = useState(document.title)
    // null — редактор ещё не разобрал текст; до этого сравнивать не с чем.
    const [savedContent, setSavedContent] = useState<string | null>(null)
    const [updatedAt, setUpdatedAt] = useState(document.updatedAt)
    const [isDefault, setIsDefault] = useState(document.isDefault)
    const [saving, setSaving] = useState(false)

    const ready = savedContent !== null
    const dirty = ready && (title !== savedTitle || content !== savedContent)
    const chars = content.length
    const pages = Math.max(1, Math.round(chars / 1800))

    const onEditorReady = (markdown: string) => {
        setContent(markdown)
        setSavedContent(markdown)
    }

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

    return (
        <div style={{display: "flex", flexDirection: "column", gap: 16}}>
            <div className="d-flex align-items-center justify-content-between" style={{flexWrap: "wrap", gap: 12}}>
                <div>
                    <h5 className="mb-0 fw-semibold">Регламент платформы</h5>
                    <div className="text-muted" style={{fontSize: "0.8rem", marginTop: 4}}>
                        Текст шага онбординга «Ознакомление с регламентом».
                    </div>
                </div>
                <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={save}
                    disabled={saving || !dirty || !content.trim()}
                >
                    {saving ? "Сохранение…" : dirty ? "Сохранить" : "Сохранено"}
                </button>
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
                <span>· {chars.toLocaleString("ru-RU")} символов (~{pages} стр.)</span>
                {dirty && <span style={{color: "#f59e0b"}}>· есть несохранённые изменения</span>}
            </div>

            <div className="card">
                <div className="card-body" style={{display: "flex", flexDirection: "column", gap: 12}}>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Заголовок документа"
                        className="form-control"
                        style={{fontSize: "0.95rem", fontWeight: 500}}
                    />
                    <RegulationsRichEditor
                        initialMarkdown={document.content}
                        onReady={onEditorReady}
                        onChange={setContent}
                    />
                </div>
            </div>
        </div>
    )
}
