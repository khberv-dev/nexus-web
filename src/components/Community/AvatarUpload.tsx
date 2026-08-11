"use client"
import {useCallback, useEffect, useRef, useState} from "react"
import {createPortal} from "react-dom"
import ReactCrop, {centerCrop, Crop, makeAspectCrop, PixelCrop} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

interface AvatarUploadProps {
    initials: string
    currentUrl?: string | null
    onUploaded?: (url: string) => void
    heroMode?: boolean
}

function centerAspectCrop(w: number, h: number): Crop {
    return centerCrop(makeAspectCrop({unit: "%", width: 90}, 1, w, h), w, h)
}

async function getCroppedBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
    const canvas = document.createElement("canvas")
    const size = 256
    canvas.width = size;
    canvas.height = size
    const ctx = canvas.getContext("2d")!
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, size, size)
    return new Promise(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.9))
}

export default function AvatarUpload({initials, currentUrl, onUploaded, heroMode}: AvatarUploadProps) {
    const [srcUrl, setSrcUrl] = useState<string | null>(null)
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const [uploading, setUploading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUrl ?? null)
    const [mounted, setMounted] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setSrcUrl(reader.result as string)
        reader.readAsDataURL(file)
    }

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const {width, height} = e.currentTarget
        setCrop(centerAspectCrop(width, height))
    }, [])

    const handleApply = async () => {
        if (!imgRef.current || !completedCrop) return
        setUploading(true)
        try {
            const blob = await getCroppedBlob(imgRef.current, completedCrop)
            const filename = "avatar.jpg"

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
            const putRes = await fetch(`/api/files/${file.id}/upload`, {
                method: "PUT",
                body: blob,
                headers: {"Content-Type": "image/jpeg"},
            })
            if (!putRes.ok) throw new Error((await putRes.json()).error ?? "Upload failed")

            // Получаем URL для отображения
            const urlRes = await fetch(`/api/files/${file.id}/url`)
            const {url} = await urlRes.json()

            setAvatarUrl(url)
            onUploaded?.(url)
            setSrcUrl(null)
            if (inputRef.current) inputRef.current.value = ""
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setUploading(false)
        }
    }

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
                            </div>
                            <div className="dash-crop-panel__ft">
                                <button
                                    className="dash-crop-panel__apply"
                                    onClick={handleApply}
                                    disabled={uploading || !completedCrop}
                                >
                                    <i className={`bx ${uploading ? "bx-loader-alt bx-spin" : "bx-check"}`}/>
                                    {uploading ? "Загрузка…" : "Применить"}
                                </button>
                                <button className="dash-crop-panel__cancel" onClick={() => setSrcUrl(null)}>
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
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
                    <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary btn-sm" onClick={handleApply}
                                disabled={uploading || !completedCrop}>
                            <i className={`bx ${uploading ? "bx-loader-alt bx-spin" : "bx-check"} me-1`}/>
                            {uploading ? "Загрузка..." : "Применить"}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSrcUrl(null)}>
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
