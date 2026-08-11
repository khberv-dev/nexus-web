"use client"

import type {AdminPendingDraft, AdminStageReleaseWave, AudienceSetter, PreviewOpener} from "./types"
import {WaveCardUnified} from "./WaveCardUnified"

export function StageReleaseWavesSection({
                                             stageId,
                                             waves,
                                             pendingDraft,
                                             onOpenPreview,
                                             onSetAudience,
                                         }: {
    stageId: string
    waves: AdminStageReleaseWave[]
    pendingDraft: AdminPendingDraft | null
    onOpenPreview: PreviewOpener
    onSetAudience?: AudienceSetter
}) {
    if (waves.length === 0 && !pendingDraft) return null

    return (
        <section>
            <div
                style={{
                    fontSize: "0.65rem",
                    color: "var(--adm-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                }}
            >
                Волны выпуска к заказчику
            </div>
            <p style={{fontSize: "0.74rem", color: "var(--adm-muted)", margin: "0 0 10px", lineHeight: 1.45}}>
                Каждая карточка — момент одобрения модератором и показ комплекта заказчику. Оранжевая колонка — цикл с
                модератором;
                голубая — замечания заказчика перед этим выпуском. Зелёная рамка — итоговый принятый комплект.
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
                    gap: 10,
                }}
            >
                {waves.map((w) => (
                    <WaveCardUnified
                        key={`rel-${stageId}-${w.waveIndex}`}
                        stageId={stageId}
                        card={{kind: "released", wave: w}}
                        onOpenPreview={onOpenPreview}
                        onSetAudience={onSetAudience}
                    />
                ))}
                {pendingDraft ? (
                    <WaveCardUnified
                        key={`draft-${stageId}`}
                        stageId={stageId}
                        card={{kind: "draft", pendingDraft}}
                        onOpenPreview={onOpenPreview}
                        onSetAudience={onSetAudience}
                    />
                ) : null}
            </div>
        </section>
    )
}

