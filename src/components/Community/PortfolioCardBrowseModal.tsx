"use client"

import {useEffect, useMemo, useState} from "react"
import type {CardAttachment, CardFile, PortfolioCard} from "./PortfolioCardEditorModal"

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

async function getFileUrl(fileId: string): Promise<string | null> {
    try {
        const r = await fetch(`/api/files/${fileId}/url`)
        const j = (await r.json()) as { url?: string }
        return j.url ?? null
    } catch {
        return null
    }
}

function isImage(f: CardFile) {
    return f.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.filename)
}

function isVideo(f: CardFile) {
    return f.mimeType?.startsWith("video/") || /\.(mp4|webm)$/i.test(f.filename)
}

function isPdf(f: CardFile) {
    return f.mimeType === "application/pdf" || /\.pdf$/i.test(f.filename)
}

interface PortfolioCardBrowseModalProps {
    card: PortfolioCard
    onClose: () => void
    onEdit: () => void
}

export function PortfolioCardBrowseModal({card, onClose, onEdit}: PortfolioCardBrowseModalProps) {
    const [resolved, setResolved] = useState<PortfolioCard | null>(null)
    const [mainUrl, setMainUrl] = useState<string | null>(null)
    const [attUrls, setAttUrls] = useState<Record<string, string>>({})

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const fresh = await fetchJson<PortfolioCard>(`/api/portfolio/cards/${card.id}`)
                if (cancelled) return
                setResolved(fresh)
                if (fresh.mainFile) {
                    const u = await getFileUrl(fresh.mainFile.id)
                    if (!cancelled) setMainUrl(u)
                } else setMainUrl(null)
                const entries = await Promise.all(
                    fresh.attachments.map(async (a) => {
                        const u = await getFileUrl(a.file.id)
                        return [a.file.id, u ?? ""] as const
                    }),
                )
                if (!cancelled) setAttUrls(Object.fromEntries(entries.filter(([, u]) => u)))
            } catch {
                if (cancelled) return
                setResolved(card)
                if (card.mainFile) {
                    const u = await getFileUrl(card.mainFile.id)
                    if (!cancelled) setMainUrl(u)
                } else setMainUrl(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [card])

    const c = resolved ?? card

    const {underMain, galleryImages, standaloneMaterials} = useMemo(() => {
        const mainId = c.mainFile?.id ?? null
        const atts = c.attachments
        const linked = (a: CardAttachment) => a.linkedVisualFileId ?? null
        const materialsFor = (visualFileId: string) => atts.filter((a) => linked(a) === visualFileId)
        const underMain = mainId ? materialsFor(mainId) : []
        const galleryImages = atts.filter((a) => !linked(a) && isImage(a.file))
        const standaloneMaterials = atts.filter((a) => !linked(a) && !isImage(a.file))
        return {mainId, underMain, galleryImages, standaloneMaterials}
    }, [c])

    const renderAttachmentBlock = (a: CardAttachment) => {
        const u = attUrls[a.file.id]
        const name = a.file.title || a.file.filename
        return (
            <div
                key={a.id}
                className="rounded-3 p-2"
                style={{border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)"}}
            >
                <div className="small fw-medium mb-2 text-truncate" style={{color: "rgba(255,255,255,0.85)"}}>
                    {name}
                </div>
                {!u && <span className="small text-muted">Ссылка загружается…</span>}
                {u && isImage(a.file) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u} alt=""
                         style={{maxWidth: "100%", maxHeight: 320, borderRadius: 8, objectFit: "contain"}}/>
                )}
                {u && isVideo(a.file) && (
                    <video src={u} controls playsInline style={{maxWidth: "100%", maxHeight: 320, borderRadius: 8}}/>
                )}
                {u && isPdf(a.file) && (
                    <a href={u} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-light"
                       download>
                        <i className="bx bx-download me-1"/>
                        Скачать PDF
                    </a>
                )}
                {u && !isImage(a.file) && !isVideo(a.file) && !isPdf(a.file) && (
                    <a href={u} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-light">
                        <i className="bx bx-link-external me-1"/>
                        Скачать / открыть
                    </a>
                )}
            </div>
        )
    }

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1080,
                background: "rgba(8,10,18,0.78)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                backdropFilter: "blur(4px)",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(900px, 96vw)",
                    maxHeight: "92vh",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 16,
                    background: "linear-gradient(165deg, rgba(26,31,58,0.98) 0%, rgba(15,19,38,0.99) 100%)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
                    color: "#e8eaf4",
                }}
            >
                <div
                    className="d-flex align-items-start justify-content-between gap-2 flex-wrap"
                    style={{padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0}}
                >
                    <div className="min-w-0">
                        <h5 className="mb-1 text-truncate" style={{fontSize: "1.05rem", color: "#f4f6ff"}}>
                            {c.title}
                        </h5>
                        {c.description && (
                            <p className="small mb-0" style={{
                                color: "rgba(255,255,255,0.55)",
                                whiteSpace: "pre-wrap",
                                maxHeight: 72,
                                overflow: "auto"
                            }}>
                                {c.description}
                            </p>
                        )}
                    </div>
                    <div className="d-flex gap-2 flex-shrink-0">
                        <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
                            <i className="bx bx-edit-alt me-1"/>
                            Изменить
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
                            Закрыть
                        </button>
                    </div>
                </div>

                <div style={{overflowY: "auto", flex: 1, padding: "16px 18px"}}>
                    <p className="small text-uppercase fw-semibold mb-2"
                       style={{letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)"}}>
                        Основной материал
                    </p>
                    <div className="mb-4 d-flex justify-content-center" style={{minHeight: 200}}>
                        {c.mainFile && mainUrl && isImage(c.mainFile) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mainUrl} alt=""
                                 style={{maxWidth: "100%", maxHeight: "55vh", borderRadius: 12, objectFit: "contain"}}/>
                        )}
                        {c.mainFile && mainUrl && isVideo(c.mainFile) && (
                            <video src={mainUrl} controls playsInline
                                   style={{maxWidth: "100%", maxHeight: "55vh", borderRadius: 12}}/>
                        )}
                        {c.mainFile && mainUrl && !isImage(c.mainFile) && !isVideo(c.mainFile) && (
                            <a href={mainUrl} target="_blank" rel="noopener noreferrer"
                               className="btn btn-outline-light">
                                <i className="bx bx-link-external me-1"/>
                                Открыть основной файл
                            </a>
                        )}
                        {!c.mainFile && <span className="text-muted small">Основной файл не задан</span>}
                        {c.mainFile && !mainUrl && <span className="text-muted small">Загрузка превью…</span>}
                    </div>

                    {underMain.length > 0 && (
                        <div className="mb-4">
                            <p className="small text-uppercase fw-semibold mb-2"
                               style={{letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)"}}>
                                Материалы к главному кадру
                            </p>
                            <div
                                className="d-flex flex-column gap-2">{underMain.map((a) => renderAttachmentBlock(a))}</div>
                        </div>
                    )}

                    {galleryImages.length > 0 && (
                        <div className="mb-4">
                            <p className="small text-uppercase fw-semibold mb-2"
                               style={{letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)"}}>
                                Дополнительные кадры
                            </p>
                            <div className="d-flex flex-column gap-4">
                                {galleryImages.map((gi) => {
                                    const nested = c.attachments.filter((a) => (a.linkedVisualFileId ?? null) === gi.file.id)
                                    const u = attUrls[gi.file.id]
                                    const name = gi.file.title || gi.file.filename
                                    return (
                                        <div key={gi.id} className="rounded-3 p-2" style={{
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(0,0,0,0.15)"
                                        }}>
                                            <div className="small fw-medium mb-2 text-truncate"
                                                 style={{color: "rgba(255,255,255,0.75)"}}>
                                                {name}
                                            </div>
                                            {!u && <span className="small text-muted">Загрузка…</span>}
                                            {u && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={u} alt="" style={{
                                                    maxWidth: "100%",
                                                    maxHeight: 280,
                                                    borderRadius: 8,
                                                    objectFit: "contain"
                                                }}/>
                                            )}
                                            {nested.length > 0 && (
                                                <div className="mt-2 pt-2"
                                                     style={{borderTop: "1px solid rgba(255,255,255,0.08)"}}>
                                                    <p className="small mb-2" style={{color: "rgba(255,255,255,0.5)"}}>
                                                        Материалы к этому кадру
                                                    </p>
                                                    <div
                                                        className="d-flex flex-column gap-2">{nested.map((a) => renderAttachmentBlock(a))}</div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {standaloneMaterials.length > 0 && (
                        <div className="mb-0">
                            <p className="small text-uppercase fw-semibold mb-2"
                               style={{letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)"}}>
                                Материалы (отдельная сетка)
                            </p>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: 12,
                                }}
                            >
                                {standaloneMaterials.map((a) => renderAttachmentBlock(a))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
