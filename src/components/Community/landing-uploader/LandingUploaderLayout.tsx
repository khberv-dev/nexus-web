"use client"

import React from "react"
import { DashCarousel } from "@/components/dashboard-ui/DashCarousel"
import { MAX_LANDING_PORTFOLIO, POS_OPTIONS, PORTRAIT_MIN_H, PORTRAIT_MIN_W, WORK_MIN_H, WORK_MIN_W } from "./constants"
import { LandingFile, PreviewState } from "./types"

interface LayoutProps {
  featuredOnLanding?: boolean
  error: string | null
  uploading: string | null
  portraitFiles: LandingFile[]
  portraitUrls: Record<string, string>
  selectedPortraitId: string | null
  introVideoFiles: LandingFile[]
  introVideoUrls: Record<string, string>
  selectedVideoId: string | null
  workFiles: LandingFile[]
  workUrls: Record<string, string>
  selectedWorkId: string | null
  workPos: string
  portfolioFiles: LandingFile[]
  portfolioUrls: Record<string, string>
  selectedIds: Set<string>
  preview: PreviewState
  portraitRef: React.RefObject<HTMLInputElement | null>
  videoRef: React.RefObject<HTMLInputElement | null>
  workRef: React.RefObject<HTMLInputElement | null>
  onPortraitChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVideoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onWorkChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSaveWorkPos: (pos: string) => void
  onSelectPortrait: (id: string) => void
  onSelectVideo: (id: string) => void
  onSelectLandingWork: (id: string) => void
  onTogglePortfolio: (id: string) => void
  onSetPreview: (value: PreviewState) => void
  onDeleteFile?: (id: string) => void
  disabled?: boolean
}

const card = (children: React.ReactNode) => <div className="landing-up-card">{children}</div>
const cardTitle = (icon: string, title: string, sub: string) => (
  <div className="landing-up-card__head">
    <div className="landing-up-card__title-row">
      <i className={`bx ${icon} landing-up-card__title-icon`} />
      <h4 className="landing-up-card__title">{title}</h4>
    </div>
    <p className="landing-up-card__sub">{sub}</p>
  </div>
)

export function LandingUploaderLayout(props: LayoutProps) {
  const {
    error, uploading, disabled,
    portraitFiles, portraitUrls, selectedPortraitId,
    introVideoFiles, introVideoUrls, selectedVideoId,
    workFiles, workUrls, selectedWorkId, workPos,
    portfolioFiles, portfolioUrls, selectedIds, preview,
    portraitRef, videoRef, workRef,
    onPortraitChange, onVideoChange, onWorkChange, onSaveWorkPos,
    onSelectPortrait, onSelectVideo, onSelectLandingWork, onTogglePortfolio, onSetPreview,
    onDeleteFile,
  } = props

  const renderSelectorMark = (selected: boolean) => (
    <span className={`landing-up-tick ${selected ? "is-selected" : ""}`}>
      <i className={`bx ${selected ? "bx-check" : "bx-circle"}`} />
    </span>
  )

  const isPreviewPrimary = !!preview?.fileId && (
    (preview.category === "PORTRAIT" && selectedPortraitId === preview.fileId) ||
    (preview.category === "INTRO_VIDEO" && selectedVideoId === preview.fileId) ||
    (preview.category === "LANDING_WORK" && selectedWorkId === preview.fileId)
  )

  const makePreviewPrimary = () => {
    if (!preview?.fileId || !preview.category || disabled) return
    if (preview.category === "PORTRAIT") onSelectPortrait(preview.fileId)
    if (preview.category === "INTRO_VIDEO") onSelectVideo(preview.fileId)
    if (preview.category === "LANDING_WORK") onSelectLandingWork(preview.fileId)
  }

  return (
    <div className="landing-up" style={disabled ? { opacity: 0.7, pointerEvents: "none" } : undefined}>
      {error && (
        <div className="landing-up-error" style={{ background: "rgba(234,84,85,0.08)", border: "1px solid rgba(234,84,85,0.2)", color: "#ea5455" }}>
          <i className="bx bx-error-circle" style={{ marginRight: 6 }} />
          {error}
        </div>
      )}

      {card(
        <>
          {cardTitle("bx-user", "Портрет", `Вертикальное, мин. ${PORTRAIT_MIN_W}x${PORTRAIT_MIN_H}px`)}
          <div className="landing-up-row-line">
            {!disabled && (
              <button type="button" className="landing-up-upload-tile" onClick={() => portraitRef.current?.click()}>
                <i className={`bx ${uploading === "portrait" ? "bx-loader-alt bx-spin" : "bx-plus"}`} />
                <span>Загрузить</span>
              </button>
            )}
            <DashCarousel className="landing-up-carousel" viewportClassName="landing-up-carousel__viewport" ariaLabel="Портреты">
              {portraitFiles.map((f) => {
                const selected = selectedPortraitId === f.id
                const url = portraitUrls[f.id]
                return (
                  <div
                    key={f.id}
                    className={`landing-up-thumb landing-up-carousel__item ${selected ? "is-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => url && onSetPreview({ url, kind: "image", title: "Портрет", fileId: f.id, category: "PORTRAIT" })}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && url) { e.preventDefault(); onSetPreview({ url, kind: "image", title: "Портрет", fileId: f.id, category: "PORTRAIT" }) } }}
                  >
                    {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="bx bx-image" />}
                    {!disabled && (
                      <span className="landing-up-thumb-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="landing-up-select-btn" onClick={() => onSelectPortrait(f.id)} title="Показать на главной">
                          {renderSelectorMark(selected)}
                        </button>
                        {onDeleteFile && (
                          <button type="button" className="landing-up-select-btn" onClick={() => onDeleteFile(f.id)} title="Удалить" style={{ marginLeft: 2 }}>
                            <i className="bx bx-trash" style={{ fontSize: 11, color: "#d64c67" }} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </DashCarousel>
          </div>
          <input ref={portraitRef} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={onPortraitChange} />
        </>,
      )}

      {card(
        <>
          {cardTitle("bx-video", "Видео-визитка", "9:16, MP4, до 100 МБ")}
          <div className="landing-up-row-line">
            {!disabled && (
              <button type="button" className="landing-up-upload-tile" onClick={() => videoRef.current?.click()}>
                <i className={`bx ${uploading === "video" ? "bx-loader-alt bx-spin" : "bx-play-circle"}`} />
                <span>Загрузить</span>
              </button>
            )}
            <DashCarousel className="landing-up-carousel" viewportClassName="landing-up-carousel__viewport" ariaLabel="Видео визитки">
              {introVideoFiles.map((f) => {
                const selected = selectedVideoId === f.id
                const url = introVideoUrls[f.id]
                return (
                  <div
                    key={f.id}
                    className={`landing-up-thumb landing-up-carousel__item ${selected ? "is-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => url && onSetPreview({ url, kind: "video", title: "Видео-визитка", fileId: f.id, category: "INTRO_VIDEO" })}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && url) { e.preventDefault(); onSetPreview({ url, kind: "video", title: "Видео-визитка", fileId: f.id, category: "INTRO_VIDEO" }) } }}
                  >
                    {url ? <video src={url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="bx bx-video" />}
                    {!disabled && (
                      <span className="landing-up-thumb-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="landing-up-select-btn" onClick={() => onSelectVideo(f.id)} title="Показать на главной">
                          {renderSelectorMark(selected)}
                        </button>
                        {onDeleteFile && (
                          <button type="button" className="landing-up-select-btn" onClick={() => onDeleteFile(f.id)} title="Удалить" style={{ marginLeft: 2 }}>
                            <i className="bx bx-trash" style={{ fontSize: 11, color: "#d64c67" }} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </DashCarousel>
          </div>
          <input ref={videoRef} type="file" accept="video/mp4" style={{ display: "none" }} onChange={onVideoChange} />
        </>,
      )}

      {card(
        <>
          {cardTitle("bx-image", "Фото интерьера", `Горизонтальное, мин. ${WORK_MIN_W}x${WORK_MIN_H}px`)}
          <div className="landing-up-row-line">
            {!disabled && (
              <button type="button" className="landing-up-upload-tile" onClick={() => workRef.current?.click()}>
                <i className={`bx ${uploading === "work" ? "bx-loader-alt bx-spin" : "bx-plus"}`} />
                <span>Загрузить</span>
              </button>
            )}
            <DashCarousel className="landing-up-carousel" viewportClassName="landing-up-carousel__viewport" ariaLabel="Интерьеры">
              {workFiles.map((f) => {
                const selected = selectedWorkId === f.id
                const url = workUrls[f.id]
                return (
                  <div
                    key={f.id}
                    className={`landing-up-thumb landing-up-carousel__item ${selected ? "is-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => url && onSetPreview({ url, kind: "image", title: "Фото интерьера", fileId: f.id, category: "LANDING_WORK" })}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && url) { e.preventDefault(); onSetPreview({ url, kind: "image", title: "Фото интерьера", fileId: f.id, category: "LANDING_WORK" }) } }}
                  >
                    {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="bx bx-image" />}
                    {!disabled && (
                      <span className="landing-up-thumb-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="landing-up-select-btn" onClick={() => onSelectLandingWork(f.id)} title="Показать на главной">
                          {renderSelectorMark(selected)}
                        </button>
                        {onDeleteFile && (
                          <button type="button" className="landing-up-select-btn" onClick={() => onDeleteFile(f.id)} title="Удалить" style={{ marginLeft: 2 }}>
                            <i className="bx bx-trash" style={{ fontSize: 11, color: "#d64c67" }} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </DashCarousel>
          </div>
          <input ref={workRef} type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={onWorkChange} />
          {selectedWorkId && !disabled && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              {POS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => onSaveWorkPos(o.value)}
                  style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: "0.7rem", cursor: "pointer",
                    border: workPos === o.value ? "1px solid #5b4fcf" : "1px solid var(--dash-border, #ddd)",
                    background: workPos === o.value ? "rgba(91,79,207,0.1)" : "transparent",
                    color: workPos === o.value ? "#5b4fcf" : "var(--dash-text, #201d1d)",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </>,
      )}

      {card(
        <>
          {cardTitle("bx-grid-alt", "Работы для портфолио", `Выберите до ${MAX_LANDING_PORTFOLIO} фото`)}
          {portfolioFiles.filter((f) => f.mimeType?.startsWith("image/")).length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--dash-muted, #aaa)", margin: 0 }}>Сначала загрузите фото во вкладке «Портфолио»</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {portfolioFiles.filter((f) => f.mimeType?.startsWith("image/")).map((f) => {
                const selected = selectedIds.has(f.id)
                const isDisabled = disabled || (!selected && selectedIds.size >= MAX_LANDING_PORTFOLIO)
                return (
                  <div
                    key={f.id}
                    onClick={() => !isDisabled && onTogglePortfolio(f.id)}
                    style={{
                      aspectRatio: "4/3", borderRadius: 8, overflow: "hidden",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      border: selected ? "2px solid #5b4fcf" : "2px solid transparent",
                      opacity: isDisabled && !selected ? 0.4 : 1, position: "relative", background: "rgba(91,79,207,0.04)",
                    }}
                  >
                    {portfolioUrls[f.id] && <img src={portfolioUrls[f.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    {selected && (
                      <div style={{
                        position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
                        background: "#5b4fcf", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700,
                      }}>
                        {Array.from(selectedIds).indexOf(f.id) + 1}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>,
      )}

      {/* Preview modal — always interactive */}
      {preview && (
        <div onClick={() => onSetPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,12,18,0.72)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: "auto", opacity: 1 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "min(960px, 96vw)", maxHeight: "90vh", borderRadius: 14,
            background: "rgba(20, 24, 36, 0.92)", border: "1px solid rgba(255,255,255,0.12)",
            padding: 12, display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.86rem", color: "#f3f5ff" }}>{preview.title}</strong>
              <div style={{ display: "flex", gap: 6 }}>
                {!disabled && preview.category && preview.fileId && (
                  <button type="button" className="landing-up-small-btn" onClick={makePreviewPrimary} disabled={isPreviewPrimary}>
                    {isPreviewPrimary ? "Основной" : "Сделать основным"}
                  </button>
                )}
                <button type="button" className="landing-up-small-btn" onClick={() => onSetPreview(null)}>Закрыть</button>
              </div>
            </div>
            <div style={{ minHeight: 240, maxHeight: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
              {preview.kind === "video"
                ? <video src={preview.url} controls playsInline style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 10 }} />
                : <img src={preview.url} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 10, objectFit: "contain" }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
