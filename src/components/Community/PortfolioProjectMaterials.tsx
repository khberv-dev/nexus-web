"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {ActionButton} from "@/components/app/AppCard"
import {uploadUserFileToPortfolio} from "@/lib/portfolioFileUpload"
import {PortfolioRemoteFilePreview} from "./PortfolioMediaPreview"

export type ProjectMaterialRow = {
    id: string
    file: { id: string; filename: string; mimeType: string | null; title: string | null }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init)
    const text = await res.text()
    let body: { error?: string } | unknown = {}
    if (text) {
        try {
            body = JSON.parse(text) as { error?: string }
        } catch {
            throw new Error(text.slice(0, 200) || `Ошибка (${res.status})`)
        }
    }
    if (!res.ok) {
        const msg =
            typeof (body as { error?: string })?.error === "string"
                ? (body as { error: string }).error
                : `Запрос не выполнен (${res.status})`
        throw new Error(msg)
    }
    return body as T
}

function fileCategoryForAttachment(file: File): "PORTFOLIO" | "DOCUMENT" {
    if (file.type.startsWith("image/")) return "PORTFOLIO"
    return "DOCUMENT"
}

async function openFileInNewTab(fileId: string) {
    const r = await fetch(`/api/files/${fileId}/url`)
    const j = (await r.json()) as { url?: string; error?: string }
    if (!r.ok) throw new Error(j.error ?? "Не удалось получить ссылку")
    if (j.url) window.open(j.url, "_blank", "noopener,noreferrer")
}

interface PortfolioProjectMaterialsProps {
    projectId: string
    disabled?: boolean
}

export function PortfolioProjectMaterials({projectId, disabled}: PortfolioProjectMaterialsProps) {
    const [rows, setRows] = useState<ProjectMaterialRow[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await fetchJson<ProjectMaterialRow[]>(`/api/portfolio/projects/${projectId}/materials`)
            setRows(data)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        void load()
    }, [load])

    const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : []
        e.target.value = ""
        if (!files.length) return
        setUploading(true)
        setError(null)
        try {
            for (const file of files) {
                const cat = fileCategoryForAttachment(file)
                const up = await uploadUserFileToPortfolio(file, cat, {
                    title: file.name.replace(/\.[^.]+$/, ""),
                    description: null,
                })
                await fetchJson(`/api/portfolio/projects/${projectId}/materials`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({fileId: up.id}),
                })
            }
            await load()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setUploading(false)
        }
    }

    const remove = async (attachmentId: string) => {
        setError(null)
        try {
            const res = await fetch(`/api/portfolio/projects/${projectId}/materials/${attachmentId}`, {method: "DELETE"})
            const text = await res.text()
            if (!res.ok) {
                let msg = `Ошибка ${res.status}`
                try {
                    const j = JSON.parse(text) as { error?: string }
                    if (j.error) msg = j.error
                } catch {
                    /* ignore */
                }
                throw new Error(msg)
            }
            setRows((prev) => prev.filter((r) => r.id !== attachmentId))
        } catch (e) {
            setError((e as Error).message)
        }
    }

    return (
        <section className="mt-4 pt-3" style={{borderTop: "1px solid rgba(255,255,255,0.08)"}}>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <div>
                    <h6 className="mb-0 small fw-semibold text-uppercase"
                        style={{letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)"}}>
                        Материалы проекта
                    </h6>
                    <p className="small mb-0 text-muted" style={{lineHeight: 1.45}}>
                        Сюда — файлы <strong>на весь проект</strong> (одна спецификация, пакет PDF на все кадры и т.п.).
                        Это не то же самое, что вложения{" "}
                        <strong>внутри работы</strong> (их добавляют в окне «Новая работа» / «Изменить» у плитки).
                        Работы можно оставить только с фото и рендерами.
                    </p>
                </div>
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        className="d-none"
                        accept=".pdf,.zip,.rar,.mp4,.dwg,.dxf,.jpg,.jpeg,.png,image/*,video/mp4,application/pdf"
                        onChange={(e) => void onPickFiles(e)}
                        disabled={disabled || uploading}
                    />
                    <ActionButton
                        type="button"
                        icon="bx-upload"
                        className="btn-sm"
                        disabled={disabled || uploading}
                        onClick={() => inputRef.current?.click()}
                    >
                        {uploading ? "Загрузка…" : "Добавить в проект"}
                    </ActionButton>
                </div>
            </div>
            {error && <small className="text-danger d-block mb-2">{error}</small>}
            {loading ? (
                <span className="small text-muted">
          <i className="bx bx-loader-alt bx-spin me-1" aria-hidden/>
          Загрузка…
        </span>
            ) : rows.length === 0 ? (
                <p className="small text-muted mb-0" style={{lineHeight: 1.5}}>
                    Пока нет общих материалов. Кнопка «Добавить в проект» — файлы для <strong>всей папки</strong>. Нужны
                    файлы к одной работе — откройте плитку
                    работы и «Изменить».
                </p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                        gap: 10,
                    }}
                >
                    {rows.map((r) => (
                        <div
                            key={r.id}
                            className="rounded-3 p-2 d-flex flex-column align-items-stretch gap-2"
                            style={{border: "1px solid rgba(255,255,255,0.12)", background: "rgba(12,16,30,0.35)"}}
                        >
                            <div className="d-flex justify-content-center">
                                <PortfolioRemoteFilePreview
                                    fileId={r.file.id}
                                    mimeType={r.file.mimeType}
                                    filename={r.file.filename}
                                    size={100}
                                    rounded={10}
                                />
                            </div>
                            <span className="small text-truncate" style={{color: "rgba(255,255,255,0.85)"}}
                                  title={r.file.filename}>
                {r.file.title || r.file.filename}
              </span>
                            <div className="d-flex gap-1 flex-wrap">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light flex-grow-1"
                                    onClick={() => void openFileInNewTab(r.file.id)}
                                >
                                    Открыть
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-danger"
                                        onClick={() => void remove(r.id)} title="Убрать из проекта">
                                    <i className="bx bx-trash" aria-hidden/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
