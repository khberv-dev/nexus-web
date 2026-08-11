"use client"

import {type CSSProperties, useCallback, useEffect, useState} from "react"
import {ImageLightbox} from "@/components/ui/ImageLightbox"
import {openAdminFileDownload} from "../utils"

type PortfolioFile = {
    id: string
    filename: string
    mimeType: string | null
    category: string
}

type CardAttachmentRow = {
    id: string
    linkedVisualFileId: string | null
    file: PortfolioFile
}

type CardRow = {
    id: string
    title: string
    mainFile?: PortfolioFile | null
    attachments: CardAttachmentRow[]
}

type ProjectAttachmentRow = {
    id: string
    file: PortfolioFile
}

type ProjectRow = {
    id: string
    name: string
    attachments: ProjectAttachmentRow[]
    cards: CardRow[]
}

function pluralRu(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
    return `${n} ${many}`
}

function summarizeLine(projects: ProjectRow[]): string {
    let works = 0
    let mats = 0
    for (const p of projects) {
        mats += p.attachments.length
        for (const c of p.cards) {
            works += 1
            mats += c.attachments.length
        }
    }
    const obj = projects.length
    if (obj === 0 && works === 0 && mats === 0) return ""
    return `${pluralRu(obj, "объект", "объекта", "объектов")} · ${pluralRu(works, "работа", "работы", "работ")} · ${pluralRu(mats, "файл", "файла", "файлов")}`
}

function formatWorksCountLabel(n: number): string {
    if (n === 0) return "нет работ"
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} работа`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} работы`
    return `${n} работ`
}

function isImageFile(f: Pick<PortfolioFile, "mimeType" | "filename">) {
    return f.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.filename)
}

function getCardCover(card: CardRow): PortfolioFile | null {
    if (card.mainFile) return card.mainFile ?? null
    const att = card.attachments.find((a) => isImageFile(a.file))
    return att?.file ?? null
}

const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08))",
    fontSize: "0.8rem",
}

function AdminCoverThumb({file}: { file: PortfolioFile }) {
    const [url, setUrl] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (!isImageFile(file)) return
        let cancelled = false
        void (async () => {
            try {
                const r = await fetch(`/api/admin/files/${file.id}/url`, {cache: "no-store"})
                const j = (await r.json()) as { url?: string }
                if (!cancelled && j.url) setUrl(j.url)
                else if (!cancelled) setFailed(true)
            } catch {
                if (!cancelled) setFailed(true)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [file.id])

    if (!isImageFile(file) || failed || !url) {
        return (
            <div
                className="adm-pf-cover-fallback"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(165deg, rgba(99,102,241,0.12) 0%, var(--adm-outer, #f3f4f6) 55%, var(--adm-sidebar, #fff) 100%)",
                }}
            >
                <i className="bx bx-image" style={{fontSize: 36, opacity: 0.35, color: "var(--adm-muted)"}}
                   aria-hidden/>
            </div>
        )
    }

    return (
        <ImageLightbox src={url} alt={file.filename} fillTrigger>
            <img src={url} alt=""
                 style={{width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none"}}/>
        </ImageLightbox>
    )
}

const GRID_STYLE = `
  .adm-pf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
    gap: 12px;
  }
  .adm-pf-cell {
    aspect-ratio: 2 / 3;
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--adm-sidebar-border, rgba(0,0,0,0.1));
    background: var(--adm-sidebar, #f9fafb);
  }
  .adm-pf-card { cursor: pointer; }
  .adm-pf-cover { position: absolute; inset: 0; }
  .adm-pf-shade {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.18) 42%, transparent 55%);
    pointer-events: none;
  }
  .adm-pf-title {
    position: absolute; left: 8px; right: 8px; bottom: 44px;
    font-size: 0.72rem; font-weight: 600; color: #f8fafc;
    text-shadow: 0 1px 6px rgba(0,0,0,0.65);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; line-height: 1.25;
    pointer-events: none;
  }
  .adm-pf-foot {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 8px 8px;
    display: flex; justify-content: flex-end; align-items: center;
    pointer-events: none;
  }
  .adm-pf-badge {
    font-size: 0.65rem; font-weight: 600;
    padding: 2px 8px; border-radius: 10px;
    background: var(--adm-active-bg, rgba(99,102,241,0.12));
    color: var(--adm-active-color, #6366f1);
    border: 1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08));
  }
`

export function SpecialistPortfolioTreeCard({specialistId}: { specialistId: string }) {
    const [projects, setProjects] = useState<ProjectRow[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [openedProjectId, setOpenedProjectId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setErr(null)
        try {
            const res = await fetch(`/api/admin/specialists/${specialistId}/portfolio`, {cache: "no-store"})
            const data = (await res.json()) as { projects?: ProjectRow[]; error?: string }
            if (!res.ok) {
                setProjects([])
                setErr(typeof data.error === "string" ? data.error : "Не удалось загрузить")
                return
            }
            const list = Array.isArray(data.projects) ? data.projects : []
            setProjects(list)
            setOpenedProjectId((prev) => {
                if (!prev) return null
                return list.some((p) => p.id === prev) ? prev : null
            })
        } catch {
            setProjects([])
            setErr("Сеть недоступна")
        } finally {
            setLoading(false)
        }
    }, [specialistId])

    useEffect(() => {
        setOpenedProjectId(null)
    }, [specialistId])

    useEffect(() => {
        void load()
    }, [load])

    if (loading) {
        return (
            <div style={{fontSize: "0.82rem", color: "var(--adm-muted)", padding: "8px 0"}}>
                Загрузка портфолио…
            </div>
        )
    }

    if (err) {
        return (
            <div className="sp-warn" style={{marginBottom: 0}}>
                {err}
                <button type="button" className="sp-btn sp-btn-ghost" style={{marginLeft: 10}}
                        onClick={() => void load()}>
                    Повторить
                </button>
            </div>
        )
    }

    if (!projects || projects.length === 0) {
        return (
            <div style={{fontSize: "0.82rem", color: "var(--adm-muted)", lineHeight: 1.5}}>
                В личном кабинете нет папок портфолио, работ и прикреплённых материалов.
            </div>
        )
    }

    const summary = summarizeLine(projects)
    const opened = openedProjectId ? projects.find((p) => p.id === openedProjectId) : null

    return (
        <div style={{display: "flex", flexDirection: "column", gap: 14}}>
            <style>{GRID_STYLE}</style>

            {summary ? (
                <div style={{fontSize: "0.72rem", color: "var(--adm-muted)", lineHeight: 1.4}}>
                    Итого (папки портфолио в ЛК): {summary}
                </div>
            ) : null}

            {!opened ? (
                <>
                    <p style={{fontSize: "0.78rem", color: "var(--adm-muted)", margin: 0, lineHeight: 1.45}}>
                        Плитки в том же формате, что в кабинете дизайнера. Нажмите папку — откроются работы и материалы.
                    </p>
                    <div className="adm-pf-grid">
                        {projects.map((project) => {
                            const worksLabel = formatWorksCountLabel(project.cards.length)
                            return (
                                <div
                                    key={project.id}
                                    role="button"
                                    tabIndex={0}
                                    className="adm-pf-cell adm-pf-card"
                                    onClick={() => setOpenedProjectId(project.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            setOpenedProjectId(project.id)
                                        }
                                    }}
                                >
                                    <div className="adm-pf-cover">
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background:
                                                    "linear-gradient(165deg, rgba(99,102,241,0.2) 0%, rgba(241,245,249,0.95) 52%, rgba(248,250,252,0.98) 100%)",
                                            }}
                                        >
                                            <i className="bx bx-folder" style={{
                                                fontSize: 52,
                                                opacity: 0.42,
                                                color: "var(--adm-active-color, #6366f1)"
                                            }} aria-hidden/>
                                        </div>
                                    </div>
                                    <div className="adm-pf-shade" aria-hidden/>
                                    <div className="adm-pf-title">{project.name}</div>
                                    <div className="adm-pf-foot">
                                        <span className="adm-pf-badge">{worksLabel}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                        <button type="button" className="sp-btn sp-btn-ghost" style={{fontSize: "0.8rem"}}
                                onClick={() => setOpenedProjectId(null)}>
                            <i className="bx bx-chevrons-left" style={{marginRight: 4}}/>
                            Все объекты
                        </button>
                        <span
                            style={{fontWeight: 600, fontSize: "0.9rem", color: "var(--adm-text)"}}>{opened.name}</span>
                    </div>

                    <p style={{fontSize: "0.78rem", color: "var(--adm-muted)", margin: 0, lineHeight: 1.45}}>
                        Работы — портретные плитки, как у дизайнера. Ниже — материалы на всю папку и списки файлов по
                        работам.
                    </p>

                    <div style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--adm-muted)",
                        marginBottom: 6
                    }}>
                        Работы
                    </div>
                    {opened.cards.length === 0 ? (
                        <div style={{fontSize: "0.8rem", color: "var(--adm-muted)", fontStyle: "italic"}}>В этой папке
                            нет работ</div>
                    ) : (
                        <div className="adm-pf-grid">
                            {opened.cards.map((card) => {
                                const cover = getCardCover(card)
                                const matCount = card.attachments.length
                                return (
                                    <div key={card.id} className="adm-pf-cell">
                                        <div className="adm-pf-cover">
                                            {cover ? (
                                                <AdminCoverThumb file={cover}/>
                                            ) : (
                                                <div
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        background: "var(--adm-outer, #f3f4f6)",
                                                    }}
                                                >
                                                    <i className="bx bx-image"
                                                       style={{fontSize: 32, opacity: 0.35, color: "var(--adm-muted)"}}
                                                       aria-hidden/>
                                                </div>
                                            )}
                                        </div>
                                        <div className="adm-pf-shade" aria-hidden/>
                                        <div className="adm-pf-title">{card.title}</div>
                                        <div className="adm-pf-foot">
                                            <span
                                                className="adm-pf-badge">{pluralRu(matCount, "файл", "файла", "файлов")}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {opened.attachments.length > 0 && (
                        <div style={{marginTop: 8}}>
                            <div style={{
                                fontSize: "0.68rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color: "var(--adm-muted)",
                                marginBottom: 8
                            }}>
                                Материалы к проекту
                            </div>
                            {opened.attachments.map((a) => (
                                <div key={a.id} style={rowStyle}>
                  <span style={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    <i className="bx bx-paperclip" style={{marginRight: 6, color: "var(--adm-muted)"}}/>
                      {a.file.filename}
                      {a.file.mimeType ? (
                          <span style={{
                              color: "var(--adm-muted)",
                              fontSize: "0.72rem",
                              marginLeft: 6
                          }}>{a.file.mimeType}</span>
                      ) : null}
                  </span>
                                    <button
                                        type="button"
                                        className="sp-btn sp-btn-ghost"
                                        style={{flexShrink: 0, fontSize: "0.7rem", padding: "3px 8px"}}
                                        onClick={() => void openAdminFileDownload(a.file.id)}
                                    >
                                        <i className="bx bx-download"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{marginTop: 12}}>
                        <div style={{
                            fontSize: "0.68rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: "var(--adm-muted)",
                            marginBottom: 8
                        }}>
                            Файлы по работам
                        </div>
                        {opened.cards.map((card) => (
                            <div
                                key={card.id}
                                style={{
                                    marginBottom: 14,
                                    padding: "10px 12px",
                                    border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.1))",
                                    borderRadius: 8,
                                    background: "var(--adm-outer, rgba(0,0,0,0.02))",
                                }}
                            >
                                <div style={{fontWeight: 600, fontSize: "0.82rem", marginBottom: 8}}>{card.title}</div>
                                {card.attachments.length === 0 ? (
                                    <div style={{fontSize: "0.75rem", color: "var(--adm-muted)"}}>Без вложений</div>
                                ) : (
                                    card.attachments.map((att, idx) => (
                                        <div
                                            key={att.id}
                                            style={{
                                                ...rowStyle,
                                                borderBottom: idx === card.attachments.length - 1 ? "none" : rowStyle.borderBottom,
                                            }}
                                        >
                                            <div style={{minWidth: 0}}>
                        <span style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block"
                        }}>
                          <i className="bx bx-file" style={{marginRight: 6, color: "var(--adm-muted)"}}/>
                            {att.file.filename}
                        </span>
                                                <span style={{fontSize: "0.68rem", color: "var(--adm-muted)"}}>
                          {att.linkedVisualFileId ? "к фото в работе" : "общая сетка работы"}
                                                    {att.file.mimeType ? ` · ${att.file.mimeType}` : ""}
                        </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="sp-btn sp-btn-ghost"
                                                style={{flexShrink: 0, fontSize: "0.7rem", padding: "3px 8px"}}
                                                onClick={() => void openAdminFileDownload(att.file.id)}
                                            >
                                                <i className="bx bx-download"/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
