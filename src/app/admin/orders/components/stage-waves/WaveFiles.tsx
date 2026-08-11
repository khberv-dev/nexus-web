"use client"

import {FileAudienceBadge} from "@/components/app/FileAudienceBadge"
import {FileThumbnail} from "../FileThumbnail"
import {isMediaFilename} from "../media"
import type {AudienceSetter, PreviewOpener, StageFileLite} from "./types"

export function WaveFiles({
                              stageId,
                              files,
                              onOpenPreview,
                              onSetAudience,
                          }: {
    stageId: string
    files: StageFileLite[]
    onOpenPreview: PreviewOpener
    onSetAudience?: AudienceSetter
}) {
    if (files.length === 0) return null

    const media = files.filter((f) => isMediaFilename(f.filename))
    const docs = files.filter((f) => !isMediaFilename(f.filename))
    const shownMedia = media.slice(0, 6)

    return (
        <div style={{marginTop: 10}}>
            {shownMedia.length > 0 ? (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                        gap: 8,
                        marginBottom: docs.length > 0 ? 8 : 0,
                    }}
                >
                    {shownMedia.map((f) => (
                        <FileThumbnail
                            key={f.id}
                            stageId={stageId}
                            file={f as never}
                            onClick={(url) => onOpenPreview({url, filename: f.filename, fileId: f.id, stageId})}
                        />
                    ))}
                </div>
            ) : null}

            {docs.length > 0 ? (
                <div style={{display: "flex", flexDirection: "column", gap: 6}}>
                    {docs.map((f) => (
                        <div key={f.id} style={{display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap"}}>
                            <a
                                href={`/api/stages/${stageId}/files/${f.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="sp-tag"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    textDecoration: "none",
                                    color: "inherit",
                                }}
                            >
                                <i className="bx bx-download"/>
                                {f.filename}
                            </a>
                            <FileAudienceBadge audience={f.audience ?? undefined}/>
                            {onSetAudience ? (
                                <select
                                    value={(f.audience ?? "SHARED") as string}
                                    onChange={(e) => onSetAudience(f.id, e.target.value as "DESIGNER" | "CLIENT" | "SHARED")}
                                    style={{
                                        fontSize: "0.65rem",
                                        padding: "1px 4px",
                                        borderRadius: 4,
                                        border: "1px solid var(--adm-sidebar-border)",
                                        background: "var(--adm-outer)",
                                        color: "inherit",
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="SHARED">Общий</option>
                                    <option value="DESIGNER">Дизайнер</option>
                                    <option value="CLIENT">Заказчик</option>
                                </select>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}

            {media.length > shownMedia.length ? (
                <div style={{marginTop: 8, fontSize: "0.7rem", color: "var(--adm-muted)"}}>
                    Ещё медиа файлов: {media.length - shownMedia.length}
                </div>
            ) : null}
        </div>
    )
}

