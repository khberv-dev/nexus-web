"use client"

import {type CSSProperties, useEffect, useMemo, useState} from "react"

function isImageMime(mimeType: string | null | undefined, filename?: string) {
    if (mimeType?.startsWith("image/")) return true
    if (filename && /\.(jpe?g|png|webp|gif)$/i.test(filename)) return true
    return false
}

function isVideoMime(mimeType: string | null | undefined, filename?: string) {
    if (mimeType?.startsWith("video/")) return true
    if (filename && /\.(mp4|webm)$/i.test(filename)) return true
    return false
}

/** Превью файла из хранилища по id (signed URL). */
export function PortfolioRemoteFilePreview({
                                               fileId,
                                               mimeType,
                                               filename,
                                               size = 112,
                                               rounded = 10,
                                               /** Растянуть на всю область родителя (родитель должен иметь размер, напр. absolute inset 0). */
                                               fillParent = false,
                                           }: {
    fileId: string
    mimeType: string | null
    filename: string
    size?: number
    rounded?: number
    fillParent?: boolean
}) {
    const [url, setUrl] = useState<string | null>(null)
    const [err, setErr] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setUrl(null)
        setErr(false)
        setLoading(true)
        ;(async () => {
            try {
                const r = await fetch(`/api/files/${fileId}/url`)
                const j = (await r.json()) as { url?: string }
                if (!cancelled && j.url) setUrl(j.url)
                else if (!cancelled) setErr(true)
            } catch {
                if (!cancelled) setErr(true)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [fileId])

    const boxStyle: CSSProperties = fillParent
        ? {
            width: "100%",
            height: "100%",
            minHeight: 0,
            borderRadius: rounded,
            border: "none",
            background: "rgba(0,0,0,0.25)",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }
        : {
            width: size,
            height: size,
            borderRadius: rounded,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.25)",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }

    if (loading && !url) {
        return (
            <div style={{...boxStyle}}>
                <i className="bx bx-loader-alt bx-spin" style={{fontSize: 22, color: "rgba(255,255,255,0.5)"}}
                   aria-hidden/>
            </div>
        )
    }

    if (url && isImageMime(mimeType, filename)) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={{...boxStyle, objectFit: "cover", padding: 0}}/>
        )
    }

    if (url && isVideoMime(mimeType, filename)) {
        return (
            <div style={{...boxStyle, position: "relative", padding: 0}}>
                <video src={url} muted playsInline style={{width: "100%", height: "100%", objectFit: "cover"}}/>
                <span
                    className="position-absolute bottom-0 start-0 end-0 text-center"
                    style={{
                        background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                        color: "#fff",
                        fontSize: 10,
                        padding: "4px 2px"
                    }}
                >
          видео
        </span>
            </div>
        )
    }

    const open =
        url && !err ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="small"
               style={{color: "var(--bs-primary, #8b7cf6)"}}>
                Открыть
            </a>
        ) : (
            <span className="small" style={{color: err ? "rgba(255,120,120,0.85)" : "rgba(255,255,255,0.45)"}}>
        {err ? "Нет доступа" : "…"}
      </span>
        )

    return (
        <div style={{...boxStyle, flexDirection: "column", gap: 4}} className="d-flex">
            <i
                className={`bx ${isVideoMime(mimeType, filename) ? "bx-movie-play" : "bx-file"}`}
                style={{
                    fontSize: Math.min(32, (fillParent ? 120 : size) * 0.28),
                    opacity: 0.75,
                    color: "rgba(255,255,255,0.75)"
                }}
                aria-hidden
            />
            {open}
        </div>
    )
}

/** Локальное превью выбранного файла до загрузки. */
export function PortfolioLocalFilePreview({file, size = 112}: { file: File; size?: number }) {
    const objectUrl = useMemo(() => URL.createObjectURL(file), [file])
    useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl])

    const boxStyle: CSSProperties = {
        width: size,
        height: size,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.14)",
        overflow: "hidden",
        flexShrink: 0,
        background: "rgba(0,0,0,0.2)",
    }

    if (objectUrl && file.type.startsWith("image/")) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={objectUrl} alt="" style={{...boxStyle, objectFit: "cover"}}/>
        )
    }

    return (
        <div style={{...boxStyle, display: "flex", alignItems: "center", justifyContent: "center"}}>
            <i className="bx bx-file" style={{fontSize: 28, opacity: 0.7, color: "rgba(255,255,255,0.75)"}}
               aria-hidden/>
        </div>
    )
}
