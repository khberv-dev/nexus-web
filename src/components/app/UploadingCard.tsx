"use client"

import React from "react"

export type UploadItemStatus = "pending" | "uploading" | "done" | "error"

export type UploadItem = {
    id: string
    name: string
    /** Размер в байтах; null — когда он неизвестен (например, файл собран из data-url). */
    size?: number | null
    mimeType?: string | null
    /** 0–100. null — прогресс неизвестен, рисуем бегущую полосу. */
    progress?: number | null
    status: UploadItemStatus
    error?: string | null
    /** Превью-картинка (blob: или data:) для изображений. */
    previewUrl?: string | null
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}

function kindOf(item: UploadItem): "image" | "video" | "archive" | "doc" {
    const mime = item.mimeType ?? ""
    if (mime.startsWith("image/")) return "image"
    if (mime.startsWith("video/")) return "video"
    const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
    if (["jpg", "jpeg", "png", "webp", "avif", "gif", "heic"].includes(ext)) return "image"
    if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video"
    if (["zip", "rar", "7z"].includes(ext)) return "archive"
    return "doc"
}

const ICON: Record<ReturnType<typeof kindOf>, string> = {
    image: "bx-image",
    video: "bx-movie-play",
    archive: "bx-archive",
    doc: "bx-file",
}

const STATUS_LABEL: Record<UploadItemStatus, string> = {
    pending: "В очереди",
    uploading: "Загружается",
    done: "Загружен",
    error: "Ошибка",
}

/** Одна карточка загрузки: превью/иконка, имя, размер, полоса прогресса, статус. */
export function UploadingCard({item, onRemove}: { item: UploadItem; onRemove?: (id: string) => void }) {
    const kind = kindOf(item)
    const isUploading = item.status === "uploading" || item.status === "pending"
    const indeterminate = isUploading && (item.progress == null)
    const percent = Math.max(0, Math.min(100, item.progress ?? 0))

    return (
        <div className={`upload-card upload-card--${item.status}`}>
            <div className="upload-card__thumb">
                {item.previewUrl && kind === "image"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.previewUrl} alt="" className="upload-card__thumb-img"/>
                    : <i className={`bx ${ICON[kind]}`}/>}
                {isUploading && <span className="upload-card__thumb-veil"><i className="bx bx-loader-alt bx-spin"/></span>}
            </div>

            <div className="upload-card__body">
                <div className="upload-card__name" title={item.name}>{item.name}</div>
                <div className="upload-card__meta">
                    {typeof item.size === "number" && <span>{formatFileSize(item.size)}</span>}
                    {typeof item.size === "number" && <span className="upload-card__dot">·</span>}
                    <span className={`upload-card__status upload-card__status--${item.status}`}>
                        {item.status === "error" ? (item.error ?? STATUS_LABEL.error) : STATUS_LABEL[item.status]}
                    </span>
                </div>
                {item.status !== "error" && (
                    <div className="upload-card__track">
                        <div
                            className={`upload-card__bar ${indeterminate ? "upload-card__bar--indeterminate" : ""}`}
                            style={indeterminate ? undefined : {width: `${item.status === "done" ? 100 : percent}%`}}
                        />
                    </div>
                )}
            </div>

            <div className="upload-card__tail">
                {item.status === "done" && <i className="bx bx-check-circle upload-card__ok"/>}
                {item.status === "error" && <i className="bx bx-error-circle upload-card__fail"/>}
                {isUploading && !indeterminate && <span className="upload-card__pct">{percent}%</span>}
                {onRemove && item.status !== "uploading" && (
                    <button type="button" className="upload-card__remove" onClick={() => onRemove(item.id)}
                            aria-label="Убрать из списка">
                        <i className="bx bx-x"/>
                    </button>
                )}
            </div>
        </div>
    )
}

/** Список карточек + стили. Рендерит null, когда грузить нечего. */
export function UploadingCards({items, title, onRemove, className}: {
    items: UploadItem[]
    title?: string
    onRemove?: (id: string) => void
    className?: string
}) {
    if (items.length === 0) return null
    const active = items.filter((i) => i.status === "uploading" || i.status === "pending").length

    return (
        <div className={`upload-cards ${className ?? ""}`}>
            <UploadingCardStyles/>
            {title && (
                <div className="upload-cards__head">
                    <span>{title}</span>
                    {active > 0 && <span className="upload-cards__count">{active} в работе</span>}
                </div>
            )}
            {items.map((item) => <UploadingCard key={item.id} item={item} onRemove={onRemove}/>)}
        </div>
    )
}

export function UploadingCardStyles() {
    return (
        <style>{`
      .upload-cards { display: flex; flex-direction: column; gap: 8px; }
      .upload-cards__head {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--dash-muted, #8f95b2); font-weight: 600;
      }
      .upload-cards__count { text-transform: none; letter-spacing: 0; font-weight: 500; opacity: 0.85; }

      .upload-card {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 10px; border-radius: 12px;
        border: 1px solid var(--dash-border, rgba(127,127,127,0.22));
        background: var(--dash-surface-2, rgba(127,127,127,0.06));
      }
      .upload-card--error { border-color: rgba(234,84,85,0.45); background: rgba(234,84,85,0.07); }
      .upload-card--done { border-color: rgba(40,199,111,0.4); }

      .upload-card__thumb {
        position: relative; flex: 0 0 auto;
        width: 40px; height: 40px; border-radius: 9px; overflow: hidden;
        display: flex; align-items: center; justify-content: center;
        background: rgba(127,127,127,0.16); color: var(--dash-muted, #8f95b2); font-size: 1.15rem;
      }
      .upload-card__thumb-img { width: 100%; height: 100%; object-fit: cover; }
      .upload-card__thumb-veil {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.42); color: #fff; font-size: 1.05rem;
      }

      .upload-card__body { flex: 1 1 auto; min-width: 0; }
      .upload-card__name {
        font-size: 0.82rem; font-weight: 500; color: var(--dash-text, inherit);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .upload-card__meta {
        display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
        margin-top: 1px; font-size: 0.72rem; color: var(--dash-muted, #8f95b2);
      }
      .upload-card__dot { opacity: 0.5; }
      .upload-card__status--uploading, .upload-card__status--pending { color: var(--dash-accent, #5b4fcf); }
      .upload-card__status--done { color: #28c76f; }
      .upload-card__status--error { color: #ea5455; }

      .upload-card__track {
        margin-top: 6px; height: 4px; border-radius: 999px; overflow: hidden;
        background: rgba(127,127,127,0.22);
      }
      .upload-card__bar {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, var(--dash-accent, #5b4fcf), #a78bfa);
        transition: width 0.2s ease;
      }
      .upload-card--done .upload-card__bar { background: #28c76f; }
      .upload-card__bar--indeterminate { width: 40%; animation: upload-card-slide 1.1s ease-in-out infinite; }
      @keyframes upload-card-slide {
        0%   { margin-left: -40%; }
        100% { margin-left: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .upload-card__bar--indeterminate { animation-duration: 2.4s; }
      }

      .upload-card__tail { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; font-size: 0.75rem; }
      .upload-card__pct { color: var(--dash-muted, #8f95b2); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
      .upload-card__ok { color: #28c76f; font-size: 1.1rem; }
      .upload-card__fail { color: #ea5455; font-size: 1.1rem; }
      .upload-card__remove {
        border: 0; background: transparent; cursor: pointer; padding: 2px;
        color: var(--dash-muted, #8f95b2); font-size: 1rem; line-height: 1; border-radius: 6px;
      }
      .upload-card__remove:hover { color: #ea5455; background: rgba(234,84,85,0.12); }
    `}</style>
    )
}
