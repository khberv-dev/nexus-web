"use client"

import React, {useRef, useState} from "react"
import {DashCarousel} from "@/components/dashboard-ui/DashCarousel"
import {MAX_LANDING_PORTFOLIO, percentToWorkPos, workPosToPercent} from "./constants"
import {LandingFile, PreviewState} from "./types"
import {UploadingCards, type UploadItem} from "@/components/app/UploadingCard"

interface LayoutProps {
    featuredOnLanding?: boolean
    error: string | null
    uploading: string | null
    introVideoFiles: LandingFile[]
    introVideoUrls: Record<string, string>
    selectedVideoId: string | null
    selectedWorkId: string | null
    workPos: string
    portfolioFiles: LandingFile[]
    portfolioUrls: Record<string, string>
    selectedIds: Set<string>
    preview: PreviewState
    videoRef: React.RefObject<HTMLInputElement | null>
    onVideoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onSaveWorkPos: (pos: string) => void
    onSelectVideo: (id: string) => void
    onSelectLandingWork: (id: string) => void
    onTogglePortfolio: (id: string) => void
    onSetPreview: (value: PreviewState) => void
    onDeleteFile?: (id: string) => void
    uploadItems?: UploadItem[]
    disabled?: boolean
}

const card = (children: React.ReactNode) => <div className="landing-up-card">{children}</div>
const cardTitle = (icon: string, title: string, sub: string) => (
    <div className="landing-up-card__head">
        <div className="landing-up-card__title-row">
            <i className={`bx ${icon} landing-up-card__title-icon`}/>
            <h4 className="landing-up-card__title">{title}</h4>
        </div>
        <p className="landing-up-card__sub">{sub}</p>
    </div>
)

export function LandingUploaderLayout(props: LayoutProps) {
    const {
        error, uploading, disabled,
        introVideoFiles, introVideoUrls, selectedVideoId,
        selectedWorkId, workPos,
        portfolioFiles, portfolioUrls, selectedIds, preview,
        videoRef,
        onVideoChange, onSaveWorkPos,
        onSelectVideo, onSelectLandingWork, onTogglePortfolio, onSetPreview,
        uploadItems,
        onDeleteFile,
    } = props

    const renderSelectorMark = (selected: boolean) => (
        <span className={`landing-up-tick ${selected ? "is-selected" : ""}`}>
      <i className={`bx ${selected ? "bx-check" : "bx-circle"}`}/>
    </span>
    )

    const portfolioImages = portfolioFiles.filter((f) => f.mimeType?.startsWith("image/"))

    // --- «Положение кадра»: перетаскивание фото внутри рамки-вьюпорта (16:9).
    // Двигаем на дельту курсора от точки нажатия, а не прыгаем в абсолютную точку клика —
    // так фото ведёт себя как объект, который тащат, а не телепортируют под курсор.
    const posPreviewRef = useRef<HTMLDivElement>(null)
    const dragOriginRef = useRef<{
        startX: number
        startY: number
        startPos: { x: number; y: number }
        rectWidth: number
        rectHeight: number
    } | null>(null)
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
    const currentPos = dragPos ?? workPosToPercent(workPos)

    const handlePosPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return
        const rect = posPreviewRef.current?.getBoundingClientRect()
        if (!rect) return
        e.currentTarget.setPointerCapture(e.pointerId)
        dragOriginRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPos: currentPos,
            rectWidth: rect.width,
            rectHeight: rect.height,
        }
        setDragPos(currentPos)
    }
    const handlePosPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const origin = dragOriginRef.current
        if (!origin) return
        const clamp = (n: number) => Math.min(Math.max(Math.round(n), 0), 100)
        // background-position% растёт вправо/вниз по картинке, а не по видимому окну —
        // при увеличении X видимая часть смещается влево, поэтому дельту курсора вычитаем.
        const dxPercent = ((e.clientX - origin.startX) / origin.rectWidth) * 100
        const dyPercent = ((e.clientY - origin.startY) / origin.rectHeight) * 100
        setDragPos({
            x: clamp(origin.startPos.x - dxPercent),
            y: clamp(origin.startPos.y - dyPercent),
        })
    }
    const commitPosDrag = () => {
        if (!dragOriginRef.current) return
        dragOriginRef.current = null
        if (dragPos !== null) onSaveWorkPos(percentToWorkPos(dragPos))
        setDragPos(null)
    }

    const isPreviewPrimary = !!preview?.fileId && (
        (preview.category === "INTRO_VIDEO" && selectedVideoId === preview.fileId) ||
        (preview.category === "LANDING_WORK" && selectedWorkId === preview.fileId)
    )

    const makePreviewPrimary = () => {
        if (!preview?.fileId || !preview.category || disabled) return
        if (preview.category === "INTRO_VIDEO") onSelectVideo(preview.fileId)
        if (preview.category === "LANDING_WORK") onSelectLandingWork(preview.fileId)
    }

    return (
        <div className="landing-up" style={disabled ? {opacity: 0.7, pointerEvents: "none"} : undefined}>
            {error && (
                <div className="landing-up-error" style={{
                    background: "rgba(234,84,85,0.08)",
                    border: "1px solid rgba(234,84,85,0.2)",
                    color: "#ea5455"
                }}>
                    <i className="bx bx-error-circle" style={{marginRight: 6}}/>
                    {error}
                </div>
            )}

            {uploadItems && uploadItems.length > 0 && (
                <div className="landing-up-card">
                    <UploadingCards items={uploadItems} title="Загрузка файлов"/>
                </div>
            )}

            {card(
                <>
                    {cardTitle("bx-video", "Видео-визитка", "9:16, MP4, до 100 МБ")}
                    <div className="landing-up-row-line">
                        {!disabled && (
                            <button type="button" className="landing-up-upload-tile"
                                    data-tour="btn-landing-video"
                                    onClick={() => videoRef.current?.click()}>
                                <i className={`bx ${uploading === "video" ? "bx-loader-alt bx-spin" : "bx-play-circle"}`}/>
                                <span>Загрузить</span>
                            </button>
                        )}
                        <DashCarousel className="landing-up-carousel" viewportClassName="landing-up-carousel__viewport"
                                      ariaLabel="Видео визитки">
                            {introVideoFiles.map((f) => {
                                const selected = selectedVideoId === f.id
                                const url = introVideoUrls[f.id]
                                return (
                                    <div
                                        key={f.id}
                                        className={`landing-up-thumb landing-up-carousel__item ${selected ? "is-selected" : ""}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => url && onSetPreview({
                                            url,
                                            kind: "video",
                                            title: "Видео-визитка",
                                            fileId: f.id,
                                            category: "INTRO_VIDEO"
                                        })}
                                        onKeyDown={(e) => {
                                            if ((e.key === "Enter" || e.key === " ") && url) {
                                                e.preventDefault();
                                                onSetPreview({
                                                    url,
                                                    kind: "video",
                                                    title: "Видео-визитка",
                                                    fileId: f.id,
                                                    category: "INTRO_VIDEO"
                                                })
                                            }
                                        }}
                                    >
                                        {url ? <video src={url} muted playsInline preload="metadata"
                                                      style={{width: "100%", height: "100%", objectFit: "cover"}}/> :
                                            <i className="bx bx-video"/>}
                                        {!disabled && (
                                            <span className="landing-up-thumb-actions"
                                                  onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="landing-up-select-btn" onClick={() => onSelectVideo(f.id)}
                                title="Показать на главной">
                          {renderSelectorMark(selected)}
                        </button>
                                                {onDeleteFile && (
                                                    <button type="button" className="landing-up-select-btn"
                                                            onClick={() => onDeleteFile(f.id)} title="Удалить"
                                                            style={{marginLeft: 2}}>
                                                        <i className="bx bx-trash"
                                                           style={{fontSize: 11, color: "#d64c67"}}/>
                                                    </button>
                                                )}
                      </span>
                                        )}
                                    </div>
                                )
                            })}
                        </DashCarousel>
                    </div>
                    <input ref={videoRef} type="file" accept="video/mp4" style={{display: "none"}}
                           onChange={onVideoChange}/>
                </>,
            )}

            {card(
                <>
                    {cardTitle("bx-image", "Фото интерьера", "Выберите фото из портфолио — лучше горизонтальное")}
                    {portfolioImages.length === 0 ? (
                        <p style={{fontSize: "0.78rem", color: "var(--dash-muted, #aaa)", margin: 0}}>
                            Сначала добавьте фото во вкладке «Портфолио».
                        </p>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                            gap: 8
                        }}>
                            {portfolioImages.map((f) => {
                                const selected = selectedWorkId === f.id
                                const url = portfolioUrls[f.id]
                                return (
                                    <div
                                        key={f.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelectLandingWork(f.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                onSelectLandingWork(f.id)
                                            }
                                        }}
                                        style={{
                                            aspectRatio: "4/3",
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            cursor: "pointer",
                                            border: selected ? "2px solid #5b4fcf" : "2px solid transparent",
                                            position: "relative",
                                            background: "rgba(91,79,207,0.04)",
                                        }}
                                    >
                                        {url && <img src={url} alt="" style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover"
                                        }}/>}
                                        {!disabled && (
                                            <span
                                                className="landing-up-thumb-actions"
                                                style={{position: "absolute", top: 6, right: 6}}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (url) onSetPreview({
                                                        url,
                                                        kind: "image",
                                                        title: "Фото интерьера",
                                                        fileId: f.id,
                                                        category: "LANDING_WORK"
                                                    })
                                                }}
                                            >
                                                <button type="button" className="landing-up-select-btn"
                                                        title="Просмотреть">
                                                    <i className="bx bx-fullscreen"/>
                                                </button>
                                            </span>
                                        )}
                                        {selected && (
                                            <div
                                                aria-hidden="true"
                                                style={{
                                                    position: "absolute",
                                                    bottom: 6,
                                                    left: 6,
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    background: "#5b4fcf",
                                                    color: "#fff",
                                                    fontSize: "0.65rem",
                                                    fontWeight: 700,
                                                    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.3)",
                                                }}
                                            >
                                                На главной
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {selectedWorkId && !disabled && (
                        <div className="landing-up-pos">
                            <div className="landing-up-pos__head">
                                <i className="bx bx-crop landing-up-pos__head-icon"/>
                                <div>
                                    <h5 className="landing-up-pos__title">Положение кадра</h5>
                                    <p className="landing-up-pos__sub">
                                        Рамка — вьюпорт браузера на главной. Перетащите фото внутри неё, чтобы
                                        выбрать, какая часть останется в кадре.
                                    </p>
                                </div>
                            </div>

                            {/* Рамка — пропорции вьюпорта браузера (16:9); фото внутри крупнее рамки на 20%
                                по каждой стороне, чтобы было куда его двигать при перетаскивании. */}
                            <div
                                ref={posPreviewRef}
                                className={`landing-up-pos__preview ${dragPos !== null ? "is-dragging" : ""}`}
                                style={portfolioUrls[selectedWorkId] ? {
                                    backgroundImage: `url('${portfolioUrls[selectedWorkId]}')`,
                                    backgroundSize: "120% 120%",
                                    backgroundPosition: `${currentPos.x}% ${currentPos.y}%`,
                                } : undefined}
                                onPointerDown={handlePosPointerDown}
                                onPointerMove={handlePosPointerMove}
                                onPointerUp={commitPosDrag}
                                onPointerCancel={commitPosDrag}
                            >
                                {!portfolioUrls[selectedWorkId] && <i className="bx bx-image"/>}
                            </div>
                        </div>
                    )}
                </>,
            )}

            {card(
                <>
                    {cardTitle("bx-grid-alt", "Работы для портфолио", `Выберите до ${MAX_LANDING_PORTFOLIO} фото`)}
                    {portfolioImages.length === 0 && (
                        <p style={{fontSize: "0.78rem", color: "var(--dash-muted, #aaa)", margin: "0 0 8px"}}>
                            Добавьте фото во вкладке «Портфолио», чтобы выбрать их сюда.
                        </p>
                    )}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: 8
                    }}>
                        {portfolioImages.map((f) => {
                                const selected = selectedIds.has(f.id)
                                const isDisabled = disabled || (!selected && selectedIds.size >= MAX_LANDING_PORTFOLIO)
                                return (
                                    <div
                                        key={f.id}
                                        onClick={() => !isDisabled && onTogglePortfolio(f.id)}
                                        style={{
                                            aspectRatio: "4/3",
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            cursor: isDisabled ? "not-allowed" : "pointer",
                                            border: selected ? "2px solid #5b4fcf" : "2px solid transparent",
                                            opacity: isDisabled && !selected ? 0.4 : 1,
                                            position: "relative",
                                            background: "rgba(91,79,207,0.04)",
                                        }}
                                    >
                                        {portfolioUrls[f.id] && <img src={portfolioUrls[f.id]} alt="" style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover"
                                        }}/>}
                                        <div
                                            aria-hidden="true"
                                            style={{
                                                position: "absolute",
                                                top: 6,
                                                right: 6,
                                                width: 20,
                                                height: 20,
                                                boxSizing: "border-box",
                                                border: selected ? "2px solid #5b4fcf" : "2px solid #fff",
                                                borderRadius: "50%",
                                                background: selected ? "#5b4fcf" : "rgba(12, 14, 22, 0.45)",
                                                color: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "0.65rem",
                                                fontWeight: 700,
                                                boxShadow: "0 1px 4px rgba(0, 0, 0, 0.3)",
                                            }}
                                        >
                                            {selected ? Array.from(selectedIds).indexOf(f.id) + 1 : null}
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </>,
            )}

            {/* Preview modal — always interactive */}
            {preview && (
                <div onClick={() => onSetPreview(null)} style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(10,12,18,0.72)",
                    zIndex: 1100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                    pointerEvents: "auto",
                    opacity: 1
                }}>
                    <div onClick={(e) => e.stopPropagation()} style={{
                        width: "min(960px, 96vw)", maxHeight: "90vh", borderRadius: 14,
                        background: "rgba(20, 24, 36, 0.92)", border: "1px solid rgba(255,255,255,0.12)",
                        padding: 12, display: "flex", flexDirection: "column", gap: 8,
                    }}>
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                            <strong style={{fontSize: "0.86rem", color: "#f3f5ff"}}>{preview.title}</strong>
                            <div style={{display: "flex", gap: 6}}>
                                {!disabled && preview.category && preview.fileId && (
                                    <button type="button" className="landing-up-small-btn" onClick={makePreviewPrimary}
                                            disabled={isPreviewPrimary}>
                                        {isPreviewPrimary ? "Основной" : "Сделать основным"}
                                    </button>
                                )}
                                <button type="button" className="landing-up-small-btn"
                                        onClick={() => onSetPreview(null)}>Закрыть
                                </button>
                            </div>
                        </div>
                        <div style={{
                            minHeight: 240,
                            maxHeight: "80vh",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                        }}>
                            {preview.kind === "video"
                                ? <video src={preview.url} controls playsInline
                                         style={{maxWidth: "100%", maxHeight: "80vh", borderRadius: 10}}/>
                                : <img src={preview.url} alt="" style={{
                                    maxWidth: "100%",
                                    maxHeight: "80vh",
                                    borderRadius: 10,
                                    objectFit: "contain"
                                }}/>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
