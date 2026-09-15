"use client"
import {useCallback, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import ReactCrop, {centerCrop, Crop, makeAspectCrop, PixelCrop} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import AiImageStudio, {type AiImageResult} from "@/components/app/AiImageStudio"
import {UploadingCards, type UploadItem} from "@/components/app/UploadingCard"
import {uploadJsonWithProgress} from "@/lib/upload-progress"
import {AiIcon} from "@/components/app/AiIcon"

interface AvatarUploadProps {
    initials: string
    currentUrl?: string | null
    onUploaded?: (url: string) => void
    heroMode?: boolean
    /** id скрытого input — чтобы открыть выбор фото из другого места страницы через <label htmlFor>. */
    inputId?: string
}

function centerAspectCrop(w: number, h: number): Crop {
    return centerCrop(makeAspectCrop({unit: "%", width: 90}, 1, w, h), w, h)
}

const AVATAR_SIZE = 256

async function getCroppedBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
    const canvas = document.createElement("canvas")
    const size = AVATAR_SIZE
    canvas.width = size;
    canvas.height = size
    const ctx = canvas.getContext("2d")!
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, size, size)
    return new Promise(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.9))
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Не удалось прочитать изображение"))
        reader.readAsDataURL(blob)
    })
}

/** Вариант от ИИ приходит произвольного размера — приводим к тому же квадрату 256×256 JPEG. */
function dataUrlToAvatarBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = AVATAR_SIZE
            canvas.height = AVATAR_SIZE
            const ctx = canvas.getContext("2d")!
            // Кадрируем по центру короткой стороны, чтобы не растянуть лицо.
            const side = Math.min(image.naturalWidth, image.naturalHeight)
            const sx = (image.naturalWidth - side) / 2
            const sy = (image.naturalHeight - side) / 2
            ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
            canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Не удалось обработать изображение"))), "image/jpeg", 0.9)
        }
        image.onerror = () => reject(new Error("Не удалось загрузить сгенерированное изображение"))
        image.src = dataUrl
    })
}

export default function AvatarUpload({initials, currentUrl, onUploaded, heroMode, inputId}: AvatarUploadProps) {
    const [srcUrl, setSrcUrl] = useState<string | null>(null)
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const [uploading, setUploading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUrl ?? null)
    const [mounted, setMounted] = useState(false)
    // Диалог с ИИ: кадр уходит в студию, оттуда возвращается готовая картинка.
    const [studioSource, setStudioSource] = useState<string | null>(null)
    const [aiResult, setAiResult] = useState<AiImageResult | null>(null)
    const [aiError, setAiError] = useState<string | null>(null)
    const [uploadItem, setUploadItem] = useState<UploadItem | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const resetAi = useCallback(() => {
        setStudioSource(null)
        setAiResult(null)
        setAiError(null)
    }, [])

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        resetAi()
        const reader = new FileReader()
        reader.onload = () => setSrcUrl(reader.result as string)
        reader.readAsDataURL(file)
    }

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const {width, height} = e.currentTarget
        setCrop(centerAspectCrop(width, height))
    }, [])

    /** Открывает диалог с ИИ по текущему кадру кроппера. */
    const openStudio = async () => {
        if (!imgRef.current || !completedCrop) return
        setAiError(null)
        try {
            const blob = await getCroppedBlob(imgRef.current, completedCrop)
            setStudioSource(await blobToDataUrl(blob))
        } catch (e) {
            setAiError(e instanceof Error ? e.message : "Не удалось подготовить кадр")
        }
    }

    const handleApply = async () => {
        if (!imgRef.current || !completedCrop) return
        setUploading(true)
        setAiError(null)
        const filename = "avatar.jpg"
        try {
            const blob = aiResult
                ? await dataUrlToAvatarBlob(aiResult.dataUrl)
                : await getCroppedBlob(imgRef.current, completedCrop)

            setUploadItem({
                id: "avatar",
                name: filename,
                size: blob.size,
                mimeType: "image/jpeg",
                progress: 0,
                status: "uploading",
                previewUrl: aiResult?.dataUrl ?? null,
            })

            // Получаем presigned URL
            const res = await fetch("/api/files", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    filename,
                    mimeType: "image/jpeg",
                    size: blob.size,
                    category: "AVATAR",
                    title: "avatar"
                }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            const {file} = await res.json()

            // Загружаем через backend, чтобы не зависеть от CORS браузера на S3
            await uploadJsonWithProgress(`/api/files/${file.id}/upload`, blob, {
                headers: {"Content-Type": "image/jpeg"},
                fallbackError: "Не удалось загрузить аватар",
                onProgress: ({percent}) =>
                    setUploadItem((prev) => (prev ? {...prev, progress: percent} : prev)),
            })
            setUploadItem((prev) => (prev ? {...prev, progress: 100, status: "done"} : prev))

            // Получаем URL для отображения
            const urlRes = await fetch(`/api/files/${file.id}/url`)
            const {url} = await urlRes.json()

            setAvatarUrl(url)
            onUploaded?.(url)
            setSrcUrl(null)
            resetAi()
            setUploadItem(null)
            if (inputRef.current) inputRef.current.value = ""
        } catch (e) {
            const message = e instanceof Error ? e.message : "Не удалось загрузить аватар"
            setAiError(message)
            setUploadItem((prev) => (prev ? {...prev, status: "error", error: message} : prev))
        } finally {
            setUploading(false)
        }
    }

    /** Кнопка запуска диалога с ИИ + состояние выбранного результата. Одна разметка на модалку и инлайн. */
    const renderAiBlock = (variant: "modal" | "inline") => {
        const muted = variant === "modal" ? "rgba(255,255,255,0.55)" : "var(--bs-secondary-color, #6c757d)"

        return (
            <div style={{marginTop: 12}}>
                <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                    <button
                        type="button"
                        onClick={() => void openStudio()}
                        disabled={uploading || !completedCrop}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "0.45em 0.9em",
                            borderRadius: 8,
                            border: "1px solid rgba(167,139,250,0.45)",
                            background: "rgba(167,139,250,0.12)",
                            color: "#a78bfa",
                            fontSize: "0.82rem",
                            fontWeight: 500,
                            fontFamily: "inherit",
                            cursor: uploading || !completedCrop ? "default" : "pointer",
                            opacity: uploading || !completedCrop ? 0.6 : 1,
                        }}
                    >
                        <AiIcon/>
                        {aiResult ? "Изменить запрос к ИИ" : "Редактировать с ИИ"}
                    </button>

                    {aiResult && (
                        <div style={{display: "flex", alignItems: "center", gap: 8}}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={aiResult.dataUrl} alt="Результат ИИ" style={{
                                width: 44, height: 44, borderRadius: 8, objectFit: "cover",
                                border: "2px solid #5b4fcf",
                            }}/>
                            <span style={{fontSize: "0.75rem", color: muted}}>Выбран результат ИИ</span>
                            <button
                                type="button"
                                onClick={() => setAiResult(null)}
                                title="Вернуть исходный кадр"
                                style={{
                                    border: 0, background: "transparent", cursor: "pointer",
                                    color: muted, fontSize: "1.05rem", lineHeight: 1, padding: 2,
                                }}
                            >
                                <i className="bx bx-x"/>
                            </button>
                        </div>
                    )}
                </div>

                {!completedCrop && (
                    <p style={{margin: "6px 0 0", fontSize: "0.72rem", color: muted}}>
                        Сначала выделите область кадра.
                    </p>
                )}

                {aiError && (
                    <div style={{
                        marginTop: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(248,113,113,0.35)",
                        background: "rgba(248,113,113,0.08)",
                        color: "#dc3545",
                        fontSize: "0.78rem",
                        lineHeight: 1.45,
                    }}>
                        {aiError}
                    </div>
                )}

                {uploadItem && (
                    <div style={{marginTop: 10}}>
                        <UploadingCards items={[uploadItem]} title="Загрузка аватара"/>
                    </div>
                )}
            </div>
        )
    }

    /** Диалог с ИИ — общий для hero- и инлайн-режима. */
    const studio = studioSource && (
        <AiImageStudio
            open
            source={{dataUrl: studioSource, previewUrl: studioSource}}
            context="avatar"
            title="Аватар с ИИ"
            applyLabel="Выбрать этот вариант"
            onApply={(result) => {
                setAiResult(result)
                setStudioSource(null)
            }}
            onClose={() => setStudioSource(null)}
        />
    )

    // ── Hero mode: кликабельный аватар в шапке col-1 ─────────────
    if (heroMode) {
        return (
            <>
                <div
                    className="dash-col1-avatar dash-avatar-btn"
                    onClick={() => inputRef.current?.click()}
                    title="Сменить фото профиля"
                >
                    {avatarUrl
                        ? <img src={avatarUrl} alt="avatar" className="dash-avatar-btn__img"/>
                        : <span className="dash-avatar-btn__initials">{initials}</span>
                    }
                    <div className="dash-avatar-btn__overlay">
                        <i className="bx bx-pencil"/>
                    </div>
                </div>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png"
                    style={{display: "none"}}
                    onChange={onFileChange}
                />

                {/* Кроппер — модальное окно */}
                {mounted && srcUrl && createPortal(
                    <div className="dash-crop-backdrop" onClick={() => setSrcUrl(null)}>
                        <div className="dash-crop-panel" onClick={e => e.stopPropagation()}>
                            <div className="dash-crop-panel__hd">
                                <span>Обрезать фото</span>
                                <button className="dash-crop-panel__close" onClick={() => setSrcUrl(null)}>
                                    <i className="bx bx-x"/>
                                </button>
                            </div>
                            <div className="dash-crop-panel__body">
                                <ReactCrop
                                    crop={crop}
                                    onChange={c => setCrop(c)}
                                    onComplete={c => setCompletedCrop(c)}
                                    aspect={1}
                                    circularCrop
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img ref={imgRef} src={srcUrl} alt="crop" onLoad={onImageLoad}
                                         style={{maxWidth: "100%"}}/>
                                </ReactCrop>
                                {renderAiBlock("modal")}
                            </div>
                            <div className="dash-crop-panel__ft">
                                <button
                                    className="dash-crop-panel__apply"
                                    onClick={handleApply}
                                    disabled={uploading || !completedCrop}
                                >
                                    <i className={`bx ${uploading ? "bx-loader-alt bx-spin" : "bx-check"}`}/>
                                    {uploading ? "Загрузка…" : aiResult ? "Применить вариант ИИ" : "Применить"}
                                </button>
                                <button className="dash-crop-panel__cancel" onClick={() => setSrcUrl(null)}>
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                {studio}
            </>
        )
    }

    return (
        <div>
            {/* Текущий аватар */}
            <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{
                    width: 80, height: 80, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                    background: "rgba(91,79,207,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid rgba(91,79,207,0.2)"
                }}>
                    {avatarUrl
                        ?
                        <img src={avatarUrl} alt="avatar" style={{width: "100%", height: "100%", objectFit: "cover"}}/>
                        : <span style={{fontSize: "1.8rem", fontWeight: 700, color: "#5b4fcf"}}>{initials}</span>}
                </div>
                <div>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => inputRef.current?.click()}>
                        <i className="bx bx-upload me-1"/>Выбрать фото
                    </button>
                    <p className="text-muted small mb-0 mt-1">JPG, PNG · до 10 МБ</p>
                </div>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="d-none"
                       onChange={onFileChange}/>
            </div>

            {/* Кроппер */}
            {srcUrl && (
                <div style={{
                    background: "rgba(0,0,0,0.03)", borderRadius: 12, padding: 16,
                    border: "1px solid rgba(91,79,207,0.15)"
                }}>
                    <p className="small text-muted mb-2">Выделите область для аватара:</p>
                    <div style={{maxWidth: 360}}>
                        <ReactCrop
                            crop={crop}
                            onChange={c => setCrop(c)}
                            onComplete={c => setCompletedCrop(c)}
                            aspect={1}
                            circularCrop
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img ref={imgRef} src={srcUrl} alt="crop" onLoad={onImageLoad} style={{maxWidth: "100%"}}/>
                        </ReactCrop>
                    </div>
                    {renderAiBlock("inline")}
                    <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary btn-sm" onClick={handleApply}
                                disabled={uploading || !completedCrop}>
                            <i className={`bx ${uploading ? "bx-loader-alt bx-spin" : "bx-check"} me-1`}/>
                            {uploading ? "Загрузка..." : aiResult ? "Применить вариант ИИ" : "Применить"}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSrcUrl(null)}>
                            Отмена
                        </button>
                    </div>
                </div>
            )}
            {studio}
        </div>
    )
}
