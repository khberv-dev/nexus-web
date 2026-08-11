"use client"

import type {AdminPendingDraft, AudienceSetter, PreviewOpener} from "./types"
import {WaveFiles} from "./WaveFiles"

function formatStageDt(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function PendingDraftCard({
                                     stageId,
                                     pendingDraft,
                                     onOpenPreview,
                                     onSetAudience,
                                 }: {
    stageId: string
    pendingDraft: AdminPendingDraft
    onOpenPreview: PreviewOpener
    onSetAudience?: AudienceSetter
}) {
    return (
        <div className="sp-stage-wave-card sp-stage-wave-card--draft">
            <div style={{fontWeight: 700, fontSize: "0.82rem"}}>Черновик</div>
            <div style={{fontSize: "0.72rem", color: "var(--adm-muted)"}}>
                После последнего выпуска — ещё не одобрено для показа заказчику
            </div>

            <div style={{paddingLeft: 10, borderLeft: "3px solid rgba(245, 158, 11, 0.9)"}}>
                <div style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "var(--adm-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                }}>
                    Модератор (текущая доработка)
                </div>
                {pendingDraft.moderatorRejections.length === 0 ? (
                    <div style={{fontSize: "0.76rem", marginTop: 4, color: "var(--adm-text)"}}>Замечаний модератора пока
                        нет</div>
                ) : (
                    <ul style={{
                        margin: "6px 0 0",
                        paddingLeft: 18,
                        fontSize: "0.76rem",
                        lineHeight: 1.45,
                        color: "var(--adm-text)"
                    }}>
                        {pendingDraft.moderatorRejections.map((x, i) => (
                            <li key={`pd-${x.createdAt}-${i}`}>
                                {x.comment?.trim() ? x.comment : "(без текста)"}
                                <span style={{
                                    color: "var(--adm-muted)",
                                    marginLeft: 6
                                }}>{formatStageDt(x.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {pendingDraft.clientRejections.length > 0 ? (
                <div style={{paddingLeft: 10, borderLeft: "3px solid rgba(56, 189, 248, 0.95)", marginTop: 10}}>
                    <div style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        color: "var(--adm-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                    }}>
                        Заказчик (после выпуска)
                    </div>
                    <ul style={{
                        margin: "6px 0 0",
                        paddingLeft: 18,
                        fontSize: "0.76rem",
                        lineHeight: 1.45,
                        color: "var(--adm-text)"
                    }}>
                        {pendingDraft.clientRejections.map((x, i) => (
                            <li key={`pd-c-${x.createdAt}-${i}`}>
                                {x.comment?.trim() ? x.comment : "(без текста)"}
                                <span style={{
                                    color: "var(--adm-muted)",
                                    marginLeft: 6
                                }}>{formatStageDt(x.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div style={{fontSize: "0.72rem", color: "var(--adm-muted)"}}>
                Новых файлов после выпуска:{" "}
                <strong style={{color: "var(--adm-text)"}}>{pendingDraft.files.length}</strong>
            </div>

            {(pendingDraft.bundles?.length
                ? pendingDraft.bundles
                : pendingDraft.files.length > 0
                    ? [{bundleIndex: 0, label: "Файлы", files: pendingDraft.files, moderatorRejection: null}]
                    : []).map((b) => {
                const mediaCount = b.files.filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i.test(f.filename.replace(/^🎬\s*/, ""))).length
                const docsCount = b.files.length - mediaCount
                const isRejected = Boolean(b.moderatorRejectedAt || (b as {
                    moderatorRejection?: unknown
                }).moderatorRejection)
                const isCurrent = !isRejected
                const moderatorRejection = (b as {
                    moderatorRejection?: { createdAt: string; comment: string | null } | null
                }).moderatorRejection ?? null

                const whatRejected =
                    mediaCount > 0 && docsCount > 0
                        ? `Отклонено: ${mediaCount} медиа + ${docsCount} файл(ов)`
                        : mediaCount > 0
                            ? `Отклонено: ${mediaCount} медиа`
                            : docsCount > 0
                                ? `Отклонено: ${docsCount} файл(ов)`
                                : "Отклонено"

                return (
                    <div key={`pd-b-${b.bundleIndex}`} style={{marginTop: 10}}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 6
                        }}>
                            <div style={{fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-text)"}}>
                                {b.label} <span
                                style={{color: "var(--adm-muted)", fontWeight: 600}}>· {b.files.length}</span>
                            </div>
                            {isRejected ? (
                                <span className="sp-badge sp-badge--danger" style={{fontSize: "0.62rem"}}>
                  Отклонено
                </span>
                            ) : isCurrent ? (
                                <span className="sp-badge sp-badge--warn" style={{fontSize: "0.62rem"}}>
                  Ожидает проверки
                </span>
                            ) : null}
                        </div>

                        {isRejected ? (
                            <div style={{fontSize: "0.72rem", color: "var(--adm-muted)", marginBottom: 8}}>
                                {whatRejected}
                            </div>
                        ) : null}

                        <WaveFiles stageId={stageId} files={b.files} onOpenPreview={onOpenPreview}
                                   onSetAudience={onSetAudience}/>

                        {isRejected ? (
                            <div style={{marginTop: 10, paddingLeft: 10, borderLeft: "3px solid rgba(239,68,68,0.95)"}}>
                                <div style={{
                                    fontSize: "0.62rem",
                                    fontWeight: 800,
                                    color: "var(--adm-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em"
                                }}>
                                    Причина
                                </div>
                                <div style={{
                                    marginTop: 6,
                                    fontSize: "0.78rem",
                                    color: "var(--adm-text)",
                                    lineHeight: 1.45
                                }}>
                                    {moderatorRejection?.comment?.trim() ? moderatorRejection.comment : "(без текста комментария)"}
                                    {moderatorRejection?.createdAt ? (
                                        <span style={{color: "var(--adm-muted)", marginLeft: 6}}>
                      {formatStageDt(moderatorRejection.createdAt)}
                    </span>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}

