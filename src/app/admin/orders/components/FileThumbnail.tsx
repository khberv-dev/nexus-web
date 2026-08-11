"use client"

import {isStageImageFilename} from "@/lib/stage-file-helpers"
import {isVideoFilename} from "./media"

export function FileThumbnail({
                                  stageId,
                                  file,
                                  onClick,
                              }: {
    stageId: string
    file: { id: string; filename: string; uploadedAt?: string }
    onClick: (url: string) => void
}) {
    const isImage = isStageImageFilename(file.filename)
    const isVideo = isVideoFilename(file.filename)
    const url = `/api/stages/${stageId}/files/${file.id}/download`
    if (!isImage && !isVideo) return null

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick(url)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick(url)
                }
            }}
            style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.12))",
                flexShrink: 0,
                position: "relative",
                background: "var(--adm-outer)",
            }}
        >
            {isImage && (
                <img
                    src={url}
                    alt={file.filename}
                    style={{width: "100%", height: "100%", objectFit: "cover", display: "block"}}
                    loading="lazy"
                />
            )}
            {isVideo && (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.4)",
                    }}
                >
                    <i className="bx bx-play-circle" style={{fontSize: "2rem", color: "#fff"}}/>
                </div>
            )}
            <div
                style={{position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s"}}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.22)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
            />
        </div>
    )
}

