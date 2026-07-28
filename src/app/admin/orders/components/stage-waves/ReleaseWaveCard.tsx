"use client"

import type { AdminStageReleaseWave, AudienceSetter, PreviewOpener } from "./types"
import { WaveFiles } from "./WaveFiles"

function formatStageDt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ReleaseWaveCard({
  stageId,
  wave,
  onOpenPreview,
  onSetAudience,
}: {
  stageId: string
  wave: AdminStageReleaseWave
  onOpenPreview: PreviewOpener
  onSetAudience?: AudienceSetter
}) {
  return (
    <div
      key={`wave-${stageId}-${wave.waveIndex}`}
      className={`sp-stage-wave-card${wave.isFinalAcceptedBundle ? " sp-stage-wave-card--final" : ""}`}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--adm-text)" }}>Выпуск {wave.displayNumber}</span>
          <div style={{ fontSize: "0.7rem", color: "var(--adm-muted)", marginTop: 4 }}>
            К заказчику · {formatStageDt(wave.releasedAt)}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
          {wave.isFinalAcceptedBundle ? (
            <span className="sp-badge sp-badge--success" style={{ fontSize: "0.6rem" }}>
              Финальная версия
            </span>
          ) : null}
          {wave.isAtClientReview ? (
            <span className="sp-badge sp-badge--warn" style={{ fontSize: "0.6rem" }}>
              У заказчика
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ paddingLeft: 10, borderLeft: "3px solid rgba(245, 158, 11, 0.9)" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Модератор (до выпуска)
        </div>
        {wave.moderatorRejections.length === 0 ? (
          <div style={{ fontSize: "0.76rem", color: "var(--adm-text)", marginTop: 4 }}>Замечаний не было</div>
        ) : (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "0.76rem", lineHeight: 1.45, color: "var(--adm-text)" }}>
            {wave.moderatorRejections.map((x, i) => (
              <li key={`${x.createdAt}-m-${i}`}>
                {x.comment?.trim() ? x.comment : "(без текста комментария)"}
                <span style={{ color: "var(--adm-muted)", marginLeft: 6 }}>{formatStageDt(x.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ paddingLeft: 10, borderLeft: "3px solid rgba(56, 189, 248, 0.95)" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Заказчик (до выпуска)
        </div>
        {wave.clientRejections.length === 0 ? (
          <div style={{ fontSize: "0.76rem", color: "var(--adm-text)", marginTop: 4 }}>
            {wave.displayNumber === 1 ? "Первый выпуск — правок заказчика перед этим не было" : "Правок по этой итерации в журнале нет"}
          </div>
        ) : (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "0.76rem", lineHeight: 1.45, color: "var(--adm-text)" }}>
            {wave.clientRejections.map((x, i) => (
              <li key={`${x.createdAt}-cl-${i}`}>
                {x.comment?.trim() ? x.comment : "(без текста)"}
                <span style={{ color: "var(--adm-muted)", marginLeft: 6 }}>{formatStageDt(x.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)" }}>
        Файлов в комплекте этой волны:{" "}
        <strong style={{ color: "var(--adm-text)" }}>{wave.files.length}</strong>
      </div>

      <WaveFiles stageId={stageId} files={wave.files} onOpenPreview={onOpenPreview} onSetAudience={onSetAudience} />
    </div>
  )
}

