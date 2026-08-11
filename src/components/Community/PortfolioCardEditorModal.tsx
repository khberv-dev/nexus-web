"use client"

import type {ReactNode} from "react"
import {useEffect, useRef, useState} from "react"
import {ActionButton, AppModal} from "@/components/app/AppCard"
import {isPortfolioVisualFile} from "@/lib/portfolioVisualFile"
import {uploadUserFileToPortfolio} from "@/lib/portfolioFileUpload"
import {PortfolioLocalFilePreview, PortfolioRemoteFilePreview} from "./PortfolioMediaPreview"

function DashSectionLabel({children}: { children: ReactNode }) {
    return (
        <p className="fw-semibold text-uppercase mb-2"
           style={{fontSize: "0.7rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)"}}>
            {children}
        </p>
    )
}

export interface CardFile {
    id: string
    filename: string
    mimeType: string | null
    title: string | null
}

export interface CardAttachment {
    id: string
    file: CardFile
    /** Привязка материала к кадру (UserFile id); null — только сетка материалов */
    linkedVisualFileId?: string | null
}

export interface PortfolioCard {
    id: string
    title: string
    description: string | null
    createdAt: string
    mainFile: CardFile | null
    attachments: CardAttachment[]
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init)
    const text = await res.text()
    let body: { error?: string } | unknown = {}
    if (text) {
        try {
            body = JSON.parse(text) as { error?: string }
        } catch {
            throw new Error(text.slice(0, 200) || `Ошибка сервера (${res.status})`)
        }
    }
    if (!res.ok) {
        const message =
            typeof (body as { error?: string })?.error === "string"
                ? (body as { error: string }).error
                : `Запрос не выполнен (${res.status})`
        throw new Error(message)
    }
    return body as T
}

function fileCategoryForAttachment(file: File): "PORTFOLIO" | "DOCUMENT" {
    if (file.type.startsWith("image/")) return "PORTFOLIO"
    return "DOCUMENT"
}

function isVisualCardFile(f: Pick<CardFile, "mimeType" | "filename">) {
    return isPortfolioVisualFile(f.mimeType, f.filename)
}

function isVisualLocalFile(f: File) {
    return f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.name)
}

/** Привязка нового файла до сохранения: отдельная сетка | главное фото | индекс предыдущего кадра в списке */
type ExtraLink = "standalone" | "main" | number

interface PortfolioCardEditorModalProps {
    mode: "create" | "edit"
    open: boolean
    projectId: string
    card: PortfolioCard | null
    onClose: () => void
    onSuccess: () => void
}

export function PortfolioCardEditorModal({
                                             mode,
                                             open,
                                             projectId,
                                             card,
                                             onClose,
                                             onSuccess,
                                         }: PortfolioCardEditorModalProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [mainPick, setMainPick] = useState<File | null>(null)
    const [extraDrafts, setExtraDrafts] = useState<Array<{ file: File; link: ExtraLink }>>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [localMain, setLocalMain] = useState<CardFile | null>(null)
    const [localAttachments, setLocalAttachments] = useState<CardAttachment[]>([])
    /** Только режим «Создать»: показывать блок материалов и загружать вложения */
    const [addMaterialsOnCreate, setAddMaterialsOnCreate] = useState(true)

    const mainInputRef = useRef<HTMLInputElement>(null)
    const extraInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) return
        setError(null)
        setSaving(false)
        setMainPick(null)
        setExtraDrafts([])
        if (mode === "edit" && card) {
            setTitle(card.title)
            setDescription(card.description ?? "")
            setLocalMain(card.mainFile)
            setLocalAttachments(
                card.attachments.map((a) => ({
                    ...a,
                    linkedVisualFileId: a.linkedVisualFileId ?? null,
                })),
            )
        } else {
            setTitle("")
            setDescription("")
            setLocalMain(null)
            setLocalAttachments([])
            setAddMaterialsOnCreate(true)
        }
    }, [open, mode, card])

    const handleClose = () => {
        if (saving) return
        onClose()
    }

    const removePendingMain = () => setMainPick(null)
    const removeExtraDraft = (index: number) => {
        setExtraDrafts((prev) => {
            const next = prev.filter((_, i) => i !== index)
            return next.map((row) => {
                if (typeof row.link !== "number") return row
                if (row.link === index) return {...row, link: "standalone"}
                if (row.link > index) return {...row, link: row.link - 1}
                return row
            })
        })
    }

    const setExtraDraftLink = (index: number, link: ExtraLink) => {
        setExtraDrafts((prev) => prev.map((row, i) => (i === index ? {...row, link} : row)))
    }

    const updateAttachmentLink = async (attachmentId: string, linkedVisualFileId: string | null) => {
        if (!card) return
        setSaving(true)
        setError(null)
        try {
            await fetchJson(`/api/portfolio/cards/${card.id}/attachments/${attachmentId}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({linkedVisualFileId}),
            })
            setLocalAttachments((prev) => prev.map((a) => (a.id === attachmentId ? {...a, linkedVisualFileId} : a)))
            onSuccess()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const removeMainOnServer = async () => {
        if (!card) return
        setSaving(true)
        setError(null)
        try {
            await fetchJson(`/api/portfolio/cards/${card.id}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({mainFileId: null}),
            })
            setLocalMain(null)
            onSuccess()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const removeAttachmentOnServer = async (attachmentId: string) => {
        if (!card) return
        setSaving(true)
        setError(null)
        try {
            const res = await fetch(`/api/portfolio/cards/${card.id}/attachments/${attachmentId}`, {method: "DELETE"})
            const text = await res.text()
            if (!res.ok) {
                let msg = `Ошибка ${res.status}`
                try {
                    const j = JSON.parse(text) as { error?: string }
                    if (j.error) msg = j.error
                } catch { /* ignore */
                }
                throw new Error(msg)
            }
            setLocalAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
            onSuccess()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const submit = async () => {
        const t = title.trim()
        if (!t) {
            setError("Укажите название работы")
            return
        }
        setSaving(true)
        setError(null)
        try {
            let newMainFileId: string | null | undefined
            if (mainPick) {
                const up = await uploadUserFileToPortfolio(mainPick, "PORTFOLIO", {
                    title: t,
                    description: description.trim() || null,
                })
                newMainFileId = up.id
            }

            const uploadExtras = mode === "edit" || addMaterialsOnCreate
            const uploadedExtraIds: string[] = []
            if (uploadExtras) {
                for (const row of extraDrafts) {
                    const cat = fileCategoryForAttachment(row.file)
                    const up = await uploadUserFileToPortfolio(row.file, cat, {
                        title: row.file.name.replace(/\.[^.]+$/, ""),
                        description: null,
                    })
                    uploadedExtraIds.push(up.id)
                }
            }

            const mainIdForLinks = newMainFileId ?? (mode === "edit" ? localMain?.id ?? null : null)

            const attachmentSpecs =
                uploadedExtraIds.length > 0
                    ? uploadedExtraIds.map((fileId, i) => {
                        const link = extraDrafts[i]?.link ?? "standalone"
                        let linkedVisualFileId: string | null = null
                        if (link === "main") {
                            if (!mainIdForLinks) throw new Error("Чтобы привязать к главному фото, сначала выберите основной файл")
                            linkedVisualFileId = mainIdForLinks
                        } else if (typeof link === "number") {
                            linkedVisualFileId = uploadedExtraIds[link] ?? null
                            if (linkedVisualFileId == null) throw new Error("Некорректная привязка к кадру")
                        }
                        return {fileId, linkedVisualFileId}
                    })
                    : undefined

            if (mode === "create") {
                await fetchJson<PortfolioCard>(`/api/portfolio/projects/${projectId}/cards`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        title: t,
                        description: description.trim() || null,
                        mainFileId: newMainFileId ?? null,
                        ...(attachmentSpecs?.length ? {attachmentSpecs} : {}),
                    }),
                })
            } else if (card) {
                await fetchJson(`/api/portfolio/cards/${card.id}`, {
                    method: "PATCH",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        title: t,
                        description: description.trim() || null,
                        ...(mainPick ? {mainFileId: newMainFileId} : {}),
                    }),
                })
                for (let i = 0; i < uploadedExtraIds.length; i++) {
                    const fileId = uploadedExtraIds[i]!
                    const link = extraDrafts[i]?.link ?? "standalone"
                    let linkedVisualFileId: string | null = null
                    if (link === "main") {
                        const mid = newMainFileId ?? localMain?.id ?? null
                        if (!mid) throw new Error("Чтобы привязать к главному фото, задайте основной файл работы")
                        linkedVisualFileId = mid
                    } else if (typeof link === "number") {
                        linkedVisualFileId = uploadedExtraIds[link] ?? null
                    }
                    await fetchJson(`/api/portfolio/cards/${card.id}/attachments`, {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({fileId, linkedVisualFileId}),
                    })
                }
            }

            onSuccess()
            onClose()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    const heading = mode === "create" ? "Новая работа" : "Работа"
    const sub =
        mode === "create"
            ? "Здесь — только вложения к этой работе (блок файлов включается чекбоксом ниже). Общие файлы на всю папку — на экране проекта, «Материалы проекта» под плитками работ."
            : "Вложения ниже относятся к этой работе. Общие материалы на весь проект — на экране папки, под сеткой работ."
    const showMaterialsSection = mode === "edit" || addMaterialsOnCreate

    return (
        <AppModal open={open} onClose={handleClose} maxWidth={640} variant="dark">
            <div className="portfolio-dash-modal"
                 style={{display: "flex", flexDirection: "column", maxHeight: "min(88vh, 720px)"}}>
                <div
                    className="d-flex align-items-start justify-content-between gap-2"
                    style={{padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0}}
                >
                    <div>
                        <h5 className="mb-1" style={{fontSize: "1.05rem", color: "#f4f6ff"}}>
                            {heading}
                        </h5>
                        <p className="small mb-0" style={{lineHeight: 1.45, color: "rgba(255,255,255,0.55)"}}>
                            {sub}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-link text-white-50 p-1"
                        aria-label="Закрыть"
                        onClick={handleClose}
                        disabled={saving}
                    >
                        <i className="bx bx-x" style={{fontSize: 22}}/>
                    </button>
                </div>

                <div style={{overflowY: "auto", flex: 1, padding: "16px 20px"}}>
                    {error && (
                        <div
                            className="py-2 small mb-3 rounded-2 px-2"
                            role="alert"
                            style={{
                                background: "rgba(220,53,69,0.12)",
                                border: "1px solid rgba(220,53,69,0.35)",
                                color: "#ffc9c9"
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <DashSectionLabel>Название</DashSectionLabel>
                    <input
                        className="form-control form-control-sm mb-3"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Например: Гостиная, вид 1"
                        disabled={saving}
                    />

                    <DashSectionLabel>Описание</DashSectionLabel>
                    <textarea
                        className="form-control form-control-sm mb-3"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Стиль, площадь, задача (по желанию)"
                        disabled={saving}
                    />

                    <DashSectionLabel>Основное фото / рендер</DashSectionLabel>
                    <p className="small mb-2" style={{marginTop: -6, color: "rgba(255,255,255,0.5)"}}>
                        JPG или PNG — превью появится сразу после выбора или загрузки.
                    </p>
                    <div className="d-flex flex-wrap align-items-start gap-3 mb-3">
                        <div className="d-flex flex-column align-items-center gap-1">
                            {mainPick ? (
                                <PortfolioLocalFilePreview file={mainPick} size={120}/>
                            ) : mode === "edit" && localMain ? (
                                <PortfolioRemoteFilePreview
                                    fileId={localMain.id}
                                    mimeType={localMain.mimeType}
                                    filename={localMain.filename}
                                    size={120}
                                />
                            ) : (
                                <div
                                    className="d-flex align-items-center justify-content-center"
                                    style={{
                                        width: 120,
                                        height: 120,
                                        borderRadius: 10,
                                        border: "1px dashed rgba(255,255,255,0.2)",
                                        background: "rgba(0,0,0,0.2)",
                                        color: "rgba(255,255,255,0.35)",
                                    }}
                                >
                                    <i className="bx bx-image" style={{fontSize: 36}} aria-hidden/>
                                </div>
                            )}
                        </div>
                        <div className="d-flex flex-column gap-2 flex-grow-1" style={{minWidth: 200}}>
                            <input
                                ref={mainInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                className="d-none"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    setMainPick(f ?? null)
                                    e.target.value = ""
                                }}
                            />
                            <ActionButton type="button" icon="bx-image-add"
                                          onClick={() => mainInputRef.current?.click()} disabled={saving}>
                                Выбрать файл
                            </ActionButton>
                            {(mainPick || (mode === "edit" && localMain)) && (
                                <span className="small text-truncate" style={{color: "rgba(255,255,255,0.65)"}}>
                  {mainPick?.name ?? (localMain ? localMain.title || localMain.filename : "")}
                </span>
                            )}
                            {mainPick && (
                                <ActionButton type="button" variant="danger" onClick={removePendingMain}
                                              disabled={saving}>
                                    Сбросить выбор
                                </ActionButton>
                            )}
                            {mode === "edit" && localMain && !mainPick && (
                                <ActionButton type="button" variant="danger" icon="bx-trash"
                                              onClick={() => void removeMainOnServer()} disabled={saving}>
                                    Убрать основной
                                </ActionButton>
                            )}
                        </div>
                    </div>

                    {mode === "create" && (
                        <div className="form-check mb-3">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="portfolio-add-materials-create"
                                checked={addMaterialsOnCreate}
                                onChange={(e) => {
                                    const on = e.target.checked
                                    setAddMaterialsOnCreate(on)
                                    if (!on) setExtraDrafts([])
                                }}
                                disabled={saving}
                            />
                            <label
                                className="form-check-label small"
                                htmlFor="portfolio-add-materials-create"
                                style={{color: "rgba(255,255,255,0.82)", cursor: "pointer"}}
                            >
                                Добавить материалы и вложения (PDF, видео, доп. кадры и привязка к фото)
                            </label>
                        </div>
                    )}

                    {showMaterialsSection && (
                        <>
                            <DashSectionLabel>Материалы и видео</DashSectionLabel>
                            <p className="small mb-2" style={{marginTop: -6, color: "rgba(255,255,255,0.5)"}}>
                                PDF, MP4, ZIP, RAR, DWG, DXF и доп. изображения. Два варианта: привязать файл к главному
                                фото или к ранее добавленному кадру (изображение),
                                либо оставить «отдельная сетка материалов» без привязки к кадру.
                            </p>
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                <input
                                    ref={extraInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.zip,.rar,.mp4,.dwg,.dxf,.jpg,.jpeg,.png,image/*,video/mp4,application/pdf"
                                    className="d-none"
                                    onChange={(e) => {
                                        const list = e.target.files ? Array.from(e.target.files) : []
                                        if (list.length) {
                                            setExtraDrafts((prev) => [...prev, ...list.map((file) => ({
                                                file,
                                                link: "standalone" as const
                                            }))])
                                        }
                                        e.target.value = ""
                                    }}
                                />
                                <ActionButton type="button" icon="bx-paperclip"
                                              onClick={() => extraInputRef.current?.click()} disabled={saving}>
                                    Добавить файлы
                                </ActionButton>
                            </div>
                            {extraDrafts.length > 0 && (
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {extraDrafts.map((row, i) => {
                                        const hasMain = !!(mainPick || (mode === "edit" && localMain))
                                        const selectVal =
                                            row.link === "standalone" ? "" : row.link === "main" ? "main" : `i:${row.link as number}`
                                        return (
                                            <div
                                                key={`${row.file.name}-${i}`}
                                                className="d-flex flex-wrap align-items-center gap-2 p-2 rounded-2"
                                                style={{
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    background: "rgba(0,0,0,0.2)"
                                                }}
                                            >
                                                <PortfolioLocalFilePreview file={row.file} size={56}/>
                                                <div className="d-flex flex-column gap-1 flex-grow-1"
                                                     style={{minWidth: 120}}>
                      <span className="small text-truncate" style={{color: "rgba(255,255,255,0.75)"}}>
                        {row.file.name}
                      </span>
                                                    {!isVisualLocalFile(row.file) && (
                                                        <select
                                                            className="form-select form-select-sm"
                                                            value={selectVal}
                                                            disabled={saving}
                                                            onChange={(e) => {
                                                                const v = e.target.value
                                                                if (v === "") setExtraDraftLink(i, "standalone")
                                                                else if (v === "main") setExtraDraftLink(i, "main")
                                                                else if (v.startsWith("i:")) setExtraDraftLink(i, Number(v.slice(2)))
                                                            }}
                                                            aria-label="Привязка к кадру"
                                                        >
                                                            <option value="">Отдельная сетка материалов</option>
                                                            {hasMain && <option value="main">К главному фото</option>}
                                                            {extraDrafts.slice(0, i).map((prev, j) =>
                                                                isVisualLocalFile(prev.file) ? (
                                                                    <option key={j} value={`i:${j}`}>
                                                                        К кадру: {prev.file.name}
                                                                    </option>
                                                                ) : null,
                                                            )}
                                                        </select>
                                                    )}
                                                    {isVisualLocalFile(row.file) && (
                                                        <span className="small"
                                                              style={{color: "rgba(255,255,255,0.45)"}}>
                          Кадр галереи (к нему можно привязать материалы ниже по списку)
                        </span>
                                                    )}
                                                </div>
                                                <button type="button"
                                                        className="btn btn-link btn-sm p-0 text-danger text-nowrap"
                                                        onClick={() => removeExtraDraft(i)} disabled={saving}>
                                                    убрать
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {mode === "edit" && localAttachments.length > 0 && (
                                <>
                                    <DashSectionLabel>Уже прикреплено</DashSectionLabel>
                                    <p className="small mb-2" style={{color: "rgba(255,255,255,0.45)"}}>
                                        Для файлов, которые не являются кадром галереи, выберите привязку. Нажмите
                                        «Открыть» на превью, чтобы открыть в новой вкладке.
                                    </p>
                                    <div className="d-flex flex-column gap-2 mb-0">
                                        {localAttachments.map((a) => {
                                            const mainId = localMain?.id ?? null
                                            const imageAnchors = localAttachments.filter(
                                                (x) => isVisualCardFile(x.file) && x.file.id !== a.file.id,
                                            )
                                            const isGalleryImage = isVisualCardFile(a.file)
                                            const selectVal = a.linkedVisualFileId ?? ""
                                            return (
                                                <div
                                                    key={a.id}
                                                    className="d-flex flex-wrap align-items-center gap-2 p-2 rounded-2"
                                                    style={{
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        background: "rgba(0,0,0,0.18)"
                                                    }}
                                                >
                                                    <PortfolioRemoteFilePreview
                                                        fileId={a.file.id}
                                                        mimeType={a.file.mimeType}
                                                        filename={a.file.filename}
                                                        size={56}
                                                        rounded={8}
                                                    />
                                                    <span className="small text-truncate flex-grow-1"
                                                          style={{minWidth: 100, color: "rgba(255,255,255,0.8)"}}>
                        {a.file.title || a.file.filename}
                      </span>
                                                    {!isGalleryImage && (
                                                        <select
                                                            className="form-select form-select-sm"
                                                            style={{maxWidth: 220}}
                                                            value={selectVal}
                                                            disabled={saving}
                                                            onChange={(e) => {
                                                                const v = e.target.value
                                                                void updateAttachmentLink(a.id, v === "" ? null : v)
                                                            }}
                                                            aria-label="Привязка к кадру"
                                                        >
                                                            <option value="">Отдельная сетка материалов</option>
                                                            {mainId && <option value={mainId}>К главному фото</option>}
                                                            {imageAnchors.map((x) => (
                                                                <option key={x.id} value={x.file.id}>
                                                                    К кадру: {x.file.title || x.file.filename}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {isGalleryImage && (
                                                        <span className="small text-nowrap"
                                                              style={{color: "rgba(255,255,255,0.45)"}}>
                          Кадр галереи
                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm p-0 text-danger text-nowrap"
                                                        onClick={() => void removeAttachmentOnServer(a.id)}
                                                        disabled={saving}
                                                    >
                                                        удалить
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div
                    className="d-flex justify-content-end gap-2"
                    style={{padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0}}
                >
                    <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose}
                            disabled={saving}>
                        Отмена
                    </button>
                    <button type="button" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                            onClick={() => void submit()} disabled={saving}>
                        <i className="bx bx-check"/>
                        {saving ? "Сохранение…" : mode === "create" ? "Создать работу" : "Сохранить"}
                    </button>
                </div>

                <style>{`
          .portfolio-dash-modal .form-check-input {
            border-color: rgba(255,255,255,0.35);
            background-color: rgba(0,0,0,0.25);
          }
          .portfolio-dash-modal .form-check-input:checked {
            background-color: rgba(115,103,240,0.95);
            border-color: rgba(115,103,240,1);
          }
          .portfolio-dash-modal .form-control,
          .portfolio-dash-modal .form-select {
            background: rgba(255,255,255,0.06);
            border-color: rgba(255,255,255,0.14);
            color: #f0f2ff;
          }
          .portfolio-dash-modal .form-control::placeholder {
            color: rgba(255,255,255,0.38);
          }
          .portfolio-dash-modal .form-control:focus,
          .portfolio-dash-modal .form-select:focus {
            background: rgba(255,255,255,0.09);
            border-color: rgba(115,103,240,0.55);
            color: #fff;
            box-shadow: 0 0 0 0.15rem rgba(115,103,240,0.2);
          }
        `}</style>
            </div>
        </AppModal>
    )
}
