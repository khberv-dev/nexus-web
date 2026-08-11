"use client"

import {useMemo} from "react"
import {FileAudienceBadge} from "@/components/app/FileAudienceBadge"
import {isStageImageFilename} from "@/lib/stage-file-helpers"
import {buildClientRevisionVariants} from "@/lib/stage-client-revision-variants"
import {buildAdminStageReleaseWaves} from "@/lib/stage-admin-release-waves"
import type {OrderStage} from "../types"
import {FileThumbnail} from "./FileThumbnail"
import {clientFileTimeIso, formatWaveDt, isVideoFilename} from "./utils"

export function StageMaterialsSection({
                                          stage,
                                          expandVariantMedia,
                                          setExpandVariantMedia,
                                          expandWaveMedia,
                                          setExpandWaveMedia,
                                          onOpenPreview,
                                      }: {
    stage: OrderStage
    expandVariantMedia: Record<number, boolean>
    setExpandVariantMedia: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
    expandWaveMedia: Record<number, boolean>
    setExpandWaveMedia: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
    onOpenPreview: (args: {
        url: string
        filename: string
        fileId: string | null
        fromArchive: boolean
    }) => void
}) {
    /** Варианты сдачи по запросам правок заказчика (CLIENT + REJECTED в reviews). */
    const revisionVariants = useMemo(() => buildClientRevisionVariants(stage), [stage.files, stage.reviews])
    const multiRound = revisionVariants.length > 1
    const lastVariantIdx = revisionVariants.length - 1

    /** Пачки по выпускам к заказчику (одобрение модератора) — как в админке. */
    const {waves} = useMemo(
        () =>
            buildAdminStageReleaseWaves({
                status: stage.status,
                files: stage.files,
                reviews: stage.reviews,
            }),
        [stage.status, stage.files, stage.reviews],
    )
    const showReleaseWaves = waves.length > 0

    return (
        <>
            {showReleaseWaves
                ? waves.map((w, wIdx) => {
                    const vf = w.files.filter((f) => f.audience !== "DESIGNER")
                    const hasContext =
                        vf.length > 0 || w.moderatorRejections.length > 0 || w.clientRejections.length > 0
                    if (!hasContext) return null

                    const waveMulti = waves.length > 1
                    const lastWIdx = waves.length - 1
                    const isPastRound = waveMulti && wIdx < lastWIdx
                    const isLastWave = wIdx === lastWIdx
                    const vMedia = vf.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename))
                    const mediaExpanded = expandWaveMedia[wIdx] ?? false
                    const shownVMedia = mediaExpanded ? vMedia : vMedia.slice(0, 12)

                    const heading = waveMulti ? `Выпуск ${w.displayNumber} из ${waves.length}` : `Материалы (${vf.length})`

                    const archivedNotice =
                        isPastRound && "Ранее отправленный комплект — только просмотр. По этой версии решение уже принято."

                    return (
                        <div
                            key={`wave-${w.waveIndex}`}
                            style={{
                                marginBottom: wIdx < lastWIdx ? "1rem" : stage.status === "CLIENT_REVIEW" ? "1rem" : 0,
                                padding: waveMulti ? "1rem" : 0,
                                borderRadius: waveMulti ? 10 : 0,
                                border: waveMulti
                                    ? `1.5px ${isPastRound ? "dashed" : "solid"} ${
                                        isPastRound
                                            ? "var(--dash-border)"
                                            : stage.status === "APPROVED" && isLastWave && w.isFinalAcceptedBundle
                                                ? "var(--dash-success)"
                                                : "var(--dash-accent-border)"
                                    }`
                                    : "none",
                                background: waveMulti
                                    ? isPastRound
                                        ? "var(--dash-surface2)"
                                        : stage.status === "APPROVED" && isLastWave && w.isFinalAcceptedBundle
                                            ? "var(--dash-success-bg)"
                                            : "var(--dash-surface)"
                                    : undefined,
                                opacity: waveMulti && isPastRound ? 0.95 : 1,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    flexWrap: "wrap",
                                    marginBottom: "0.45rem",
                                }}
                            >
                                <div style={{minWidth: 0}}>
                                    <p
                                        style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.07em",
                                            color: "var(--dash-muted)",
                                            margin: 0,
                                        }}
                                    >
                                        {heading}
                                    </p>
                                    <p style={{
                                        fontSize: "0.7rem",
                                        color: "var(--dash-muted)",
                                        margin: "4px 0 0",
                                        fontWeight: 500
                                    }}>
                                        К заказчику · {formatWaveDt(w.releasedAt)}
                                    </p>
                                </div>
                                <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
                                    {waveMulti && isLastWave && w.isFinalAcceptedBundle && stage.status === "APPROVED" && (
                                        <span
                                            style={{
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                color: "var(--dash-success)",
                                                padding: "3px 10px",
                                                borderRadius: 999,
                                                background: "rgba(46,184,92,0.12)",
                                                border: "1px solid var(--dash-success)",
                                            }}
                                        >
                        Принято — финальная версия
                      </span>
                                    )}
                                    {waveMulti && isLastWave && w.isAtClientReview && stage.status === "CLIENT_REVIEW" && (
                                        <span
                                            style={{
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                color: "var(--dash-warn)",
                                                padding: "3px 10px",
                                                borderRadius: 999,
                                                background: "var(--dash-warn-bg)",
                                                border: "1px solid var(--dash-warn)",
                                            }}
                                        >
                        На согласовании
                      </span>
                                    )}
                                    {waveMulti && isLastWave && stage.status === "CLIENT_REVISION" && (
                                        <span
                                            style={{
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                color: "var(--dash-muted)",
                                                padding: "3px 10px",
                                                borderRadius: 999,
                                                background: "var(--dash-surface2)",
                                                border: "1px solid var(--dash-border)",
                                            }}
                                        >
                        Доработка у дизайнера
                      </span>
                                    )}
                                </div>
                            </div>

                            {archivedNotice ? (
                                <p style={{
                                    fontSize: "0.75rem",
                                    color: "var(--dash-muted)",
                                    margin: "0 0 0.65rem",
                                    lineHeight: 1.45
                                }}>
                                    {archivedNotice}
                                </p>
                            ) : null}

                            {w.moderatorRejections.length > 0 ? (
                                <div style={{
                                    marginBottom: "0.65rem",
                                    paddingLeft: 10,
                                    borderLeft: "3px solid rgba(245, 158, 11, 0.9)"
                                }}>
                                    <p style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 600,
                                        color: "var(--dash-muted)",
                                        margin: "0 0 0.35rem"
                                    }}>
                                        Комментарий модератора до выпуска
                                    </p>
                                    <ul style={{
                                        margin: 0,
                                        paddingLeft: 18,
                                        fontSize: "0.78rem",
                                        lineHeight: 1.45,
                                        color: "var(--dash-text)"
                                    }}>
                                        {w.moderatorRejections.map((x, i) => (
                                            <li key={`wm-${w.waveIndex}-${i}`}>
                                                {x.comment?.trim() ? x.comment : "(без текста)"}
                                                <span style={{
                                                    color: "var(--dash-muted)",
                                                    marginLeft: 6
                                                }}>{formatWaveDt(x.createdAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {w.clientRejections.length > 0 ? (
                                <div style={{
                                    marginBottom: "0.65rem",
                                    paddingLeft: 10,
                                    borderLeft: "3px solid rgba(56, 189, 248, 0.95)"
                                }}>
                                    <p style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 600,
                                        color: "var(--dash-muted)",
                                        margin: "0 0 0.35rem"
                                    }}>
                                        Ваши замечания до этого выпуска
                                    </p>
                                    <ul style={{
                                        margin: 0,
                                        paddingLeft: 18,
                                        fontSize: "0.78rem",
                                        lineHeight: 1.45,
                                        color: "var(--dash-text)"
                                    }}>
                                        {w.clientRejections.map((x, i) => (
                                            <li key={`wc-${w.waveIndex}-${i}`}>
                                                {x.comment?.trim() ? x.comment : "(без текста)"}
                                                <span style={{
                                                    color: "var(--dash-muted)",
                                                    marginLeft: 6
                                                }}>{formatWaveDt(x.createdAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {vMedia.length > 0 && (
                                <div style={{marginBottom: 10}}>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                        gap: 8
                                    }}>
                                        {shownVMedia.map((f) => (
                                            <FileThumbnail
                                                key={f.id}
                                                stageId={stage.id}
                                                file={{
                                                    id: f.id,
                                                    filename: f.filename,
                                                    createdAt: clientFileTimeIso(f) || new Date(0).toISOString(),
                                                    audience: f.audience,
                                                }}
                                                onClick={(url) =>
                                                    onOpenPreview({
                                                        url,
                                                        filename: f.filename,
                                                        fileId: f.id,
                                                        fromArchive: isPastRound,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                    {vMedia.length > 12 && (
                                        <button
                                            type="button"
                                            onClick={() => setExpandWaveMedia((prev) => ({
                                                ...prev,
                                                [wIdx]: !mediaExpanded
                                            }))}
                                            style={{
                                                marginTop: 10,
                                                background: "transparent",
                                                border: "1px solid var(--dash-border)",
                                                color: "var(--dash-muted)",
                                                borderRadius: 8,
                                                padding: "6px 10px",
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {mediaExpanded ? "Свернуть" : `Показать ещё (${vMedia.length - 12})`}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div style={{display: "flex", flexDirection: "column", gap: "0.35rem"}}>
                                {vf.map((f, idx) => (
                                    <div key={f.id}>
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.4rem",
                                                fontSize: "0.82rem",
                                                color: isPastRound ? "var(--dash-muted)" : "var(--dash-accent)",
                                                padding: "0.3em 0.7em",
                                                borderRadius: 6,
                                                border: `1px solid ${isPastRound ? "var(--dash-border)" : "var(--dash-accent-border)"}`,
                                                background: isPastRound ? "var(--dash-surface)" : "var(--dash-accent-bg)",
                                                width: "fit-content",
                                            }}
                                        >
                        <span style={{fontSize: "0.68rem", color: "var(--dash-muted)", fontWeight: 600, minWidth: 18}}>
                          #{vf.length - idx}
                        </span>
                                            <a
                                                href={`/api/stages/${stage.id}/files/${f.id}/download`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem",
                                                    color: isPastRound ? "var(--dash-muted)" : "var(--dash-accent)",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                <i className="bx bx-paperclip"/>
                                                <span style={{
                                                    maxWidth: 220,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}>
                            {f.filename}
                          </span>
                                            </a>
                                            <span style={{
                                                fontSize: "0.65rem",
                                                color: "var(--dash-muted)",
                                                marginLeft: 4,
                                                whiteSpace: "nowrap"
                                            }}>
                          {(() => {
                              const t = clientFileTimeIso(f)
                              return t
                                  ? new Date(t).toLocaleString("ru-RU", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                  })
                                  : "—"
                          })()}
                        </span>
                                            <FileAudienceBadge audience={f.audience}/>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {isPastRound && stage.status === "CLIENT_REVIEW" ? (
                                <div style={{
                                    marginTop: "0.75rem",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.75rem",
                                    alignItems: "center"
                                }}>
                                    <button
                                        type="button"
                                        disabled
                                        title="Этот выпуск уже архивный"
                                        aria-disabled
                                        style={{
                                            padding: "0.6em 1.25em",
                                            borderRadius: 8,
                                            border: "1.5px solid var(--dash-border)",
                                            background: "transparent",
                                            color: "var(--dash-muted)",
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                            cursor: "not-allowed",
                                            fontFamily: "inherit",
                                            opacity: 0.55,
                                        }}
                                    >
                                        На доработку
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    )
                })
                : revisionVariants.some((v) => v.files.length > 0) &&
                revisionVariants.map((variant, vIdx) => {
                    const vf = variant.files
                    if (vf.length === 0) return null

                    const isPastRound = multiRound && vIdx < lastVariantIdx
                    const isLastVariant = vIdx === lastVariantIdx
                    const vMedia = vf.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename))
                    const mediaExpanded = expandVariantMedia[vIdx] ?? false
                    const shownVMedia = mediaExpanded ? vMedia : vMedia.slice(0, 12)

                    const heading = multiRound ? `Вариант ${variant.displayRound} из ${revisionVariants.length}` : `Файлы (${vf.length})`

                    const archivedNotice =
                        isPastRound &&
                        "Ранее отправленные материалы — только просмотр. По этой версии замечания уже переданы дизайнеру."

                    return (
                        <div
                            key={`variant-${variant.variantIndex}`}
                            style={{
                                marginBottom: vIdx < lastVariantIdx ? "1rem" : stage.status === "CLIENT_REVIEW" ? "1rem" : 0,
                                padding: multiRound ? "1rem" : 0,
                                borderRadius: multiRound ? 10 : 0,
                                border: multiRound
                                    ? `1.5px ${isPastRound ? "dashed" : "solid"} ${
                                        isPastRound
                                            ? "var(--dash-border)"
                                            : stage.status === "APPROVED" && isLastVariant
                                                ? "var(--dash-success)"
                                                : "var(--dash-accent-border)"
                                    }`
                                    : "none",
                                background: multiRound
                                    ? isPastRound
                                        ? "var(--dash-surface2)"
                                        : stage.status === "APPROVED" && isLastVariant
                                            ? "var(--dash-success-bg)"
                                            : "var(--dash-surface)"
                                    : undefined,
                                opacity: multiRound && isPastRound ? 0.95 : 1,
                            }}
                        >
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                flexWrap: "wrap",
                                marginBottom: "0.45rem"
                            }}>
                                <p style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "var(--dash-muted)",
                                    margin: 0
                                }}>
                                    {heading}
                                </p>
                                <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
                                    {multiRound && isLastVariant && stage.status === "APPROVED" && (
                                        <span style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            color: "var(--dash-success)",
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            background: "rgba(46,184,92,0.12)",
                                            border: "1px solid var(--dash-success)"
                                        }}>
                        Принято — финальная версия
                      </span>
                                    )}
                                    {multiRound && isLastVariant && stage.status === "CLIENT_REVIEW" && (
                                        <span style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            color: "var(--dash-warn)",
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            background: "var(--dash-warn-bg)",
                                            border: "1px solid var(--dash-warn)"
                                        }}>
                        На согласовании
                      </span>
                                    )}
                                    {multiRound && isLastVariant && stage.status === "CLIENT_REVISION" && (
                                        <span style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            color: "var(--dash-muted)",
                                            padding: "3px 10px",
                                            borderRadius: 999,
                                            background: "var(--dash-surface2)",
                                            border: "1px solid var(--dash-border)"
                                        }}>
                        Доработка у дизайнера
                      </span>
                                    )}
                                </div>
                            </div>

                            {archivedNotice ? (
                                <p style={{
                                    fontSize: "0.75rem",
                                    color: "var(--dash-muted)",
                                    margin: "0 0 0.65rem",
                                    lineHeight: 1.45
                                }}>
                                    {archivedNotice}
                                </p>
                            ) : null}

                            {variant.revisionFeedback ? (
                                <div style={{
                                    marginBottom: "0.65rem",
                                    padding: "0.55rem 0.65rem",
                                    borderRadius: 8,
                                    background: "var(--dash-surface2)",
                                    borderLeft: "3px solid var(--dash-warn)"
                                }}>
                                    <p style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 600,
                                        color: "var(--dash-muted)",
                                        margin: "0 0 0.25rem"
                                    }}>
                                        Замечания к этой версии
                                    </p>
                                    <p style={{
                                        fontSize: "0.82rem",
                                        color: "var(--dash-text)",
                                        margin: 0,
                                        whiteSpace: "pre-wrap"
                                    }}>{variant.revisionFeedback}</p>
                                </div>
                            ) : null}

                            {vMedia.length > 0 && (
                                <div style={{marginBottom: 10}}>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                        gap: 8
                                    }}>
                                        {shownVMedia.map((f) => (
                                            <FileThumbnail
                                                key={f.id}
                                                stageId={stage.id}
                                                file={{
                                                    id: f.id,
                                                    filename: f.filename,
                                                    createdAt: clientFileTimeIso(f) || new Date(0).toISOString(),
                                                    audience: f.audience,
                                                }}
                                                onClick={(url) =>
                                                    onOpenPreview({
                                                        url,
                                                        filename: f.filename,
                                                        fileId: f.id,
                                                        fromArchive: isPastRound,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                    {vMedia.length > 12 && (
                                        <button
                                            type="button"
                                            onClick={() => setExpandVariantMedia((prev) => ({
                                                ...prev,
                                                [vIdx]: !mediaExpanded
                                            }))}
                                            style={{
                                                marginTop: 10,
                                                background: "transparent",
                                                border: "1px solid var(--dash-border)",
                                                color: "var(--dash-muted)",
                                                borderRadius: 8,
                                                padding: "6px 10px",
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {mediaExpanded ? "Свернуть" : `Показать ещё (${vMedia.length - 12})`}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div style={{display: "flex", flexDirection: "column", gap: "0.35rem"}}>
                                {vf.map((f, idx) => (
                                    <div key={f.id}>
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.4rem",
                                                fontSize: "0.82rem",
                                                color: isPastRound ? "var(--dash-muted)" : "var(--dash-accent)",
                                                padding: "0.3em 0.7em",
                                                borderRadius: 6,
                                                border: `1px solid ${isPastRound ? "var(--dash-border)" : "var(--dash-accent-border)"}`,
                                                background: isPastRound ? "var(--dash-surface)" : "var(--dash-accent-bg)",
                                                width: "fit-content",
                                            }}
                                        >
                        <span style={{fontSize: "0.68rem", color: "var(--dash-muted)", fontWeight: 600, minWidth: 18}}>
                          #{vf.length - idx}
                        </span>
                                            <a
                                                href={`/api/stages/${stage.id}/files/${f.id}/download`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem",
                                                    color: isPastRound ? "var(--dash-muted)" : "var(--dash-accent)",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                <i className="bx bx-paperclip"/>
                                                <span style={{
                                                    maxWidth: 220,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}>{f.filename}</span>
                                            </a>
                                            <span style={{
                                                fontSize: "0.65rem",
                                                color: "var(--dash-muted)",
                                                marginLeft: 4,
                                                whiteSpace: "nowrap"
                                            }}>
                          {(() => {
                              const t = clientFileTimeIso(f)
                              return t
                                  ? new Date(t).toLocaleString("ru-RU", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                  })
                                  : "—"
                          })()}
                        </span>
                                            <FileAudienceBadge audience={f.audience}/>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {isPastRound && stage.status === "CLIENT_REVIEW" ? (
                                <div style={{
                                    marginTop: "0.75rem",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.75rem",
                                    alignItems: "center"
                                }}>
                                    <button
                                        type="button"
                                        disabled
                                        title="Замечания по этой версии уже отправлены дизайнеру"
                                        aria-disabled
                                        style={{
                                            padding: "0.6em 1.25em",
                                            borderRadius: 8,
                                            border: "1.5px solid var(--dash-border)",
                                            background: "transparent",
                                            color: "var(--dash-muted)",
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                            cursor: "not-allowed",
                                            fontFamily: "inherit",
                                            opacity: 0.55,
                                        }}
                                    >
                                        На доработку
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    )
                })}
        </>
    )
}

