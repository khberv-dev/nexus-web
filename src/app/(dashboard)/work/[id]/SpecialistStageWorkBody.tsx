"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { StageType } from "@prisma/client"
import { FileAudienceBadge } from "@/components/app/FileAudienceBadge"
import { StageUpload } from "@/components/app/StageUpload"
import type { OrderStage } from "@/app/orders/[id]/types"
import { MAX_FREE_CLIENT_REVISIONS } from "@/lib/stage-constants"
import { buildClientRevisionVariants } from "@/lib/stage-client-revision-variants"
import { buildAdminStageReleaseWaves } from "@/lib/stage-admin-release-waves"
import { isStageImageFilename } from "@/lib/stage-file-helpers"

const isVideoFilename = (name: string) => /\.(mp4|webm|mov)$/i.test(name.replace(/^🎬\s*/, ""))

function formatWaveDt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function specialistFileTimeIso(f: { createdAt?: string; uploadedAt?: string }) {
  return (f.createdAt?.trim() || f.uploadedAt?.trim() || "").trim()
}

function FileThumbnail({ stageId, file, onClick }: {
  stageId: string
  file: { id: string; filename: string; createdAt: string }
  onClick: (url: string) => void
}) {
  const isImage = isStageImageFilename(file.filename)
  const isVideo = isVideoFilename(file.filename)
  const url = `/api/stages/${stageId}/files/${file.id}/download`
  if (!isImage && !isVideo) return null
  return (
    <div role="button" tabIndex={0} onClick={() => onClick(url)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(url) } }} style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid var(--dash-border)", flexShrink: 0, position: "relative", background: "var(--dash-surface2)" }}>
      {isImage && (
        <img src={url} alt={file.filename} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      )}
      {isVideo && (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
          <i className="bx bx-play-circle" style={{ fontSize: "2rem", color: "#fff" }} />
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.25)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
      />
    </div>
  )
}

const ACT_STATUS_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  PENDING: { label: "Ожидает загрузки", icon: "bx bx-file-blank", color: "var(--dash-muted)" },
  SPECIALIST_UPLOADED: { label: "Загружен, ожидает проверки", icon: "bx bx-cloud-upload", color: "var(--dash-accent)" },
  ADMIN_APPROVED: { label: "Проверен, ожидает подписи заказчика", icon: "bx bx-check", color: "var(--dash-warn)" },
  CLIENT_SIGNED: { label: "Подписан заказчиком, ожидает подтверждения", icon: "bx bx-user-check", color: "var(--dash-accent)" },
  CONFIRMED: { label: "Подтвержден", icon: "bx-check-double", color: "var(--dash-success)" },
  REJECTED: { label: "Требует доработки", icon: "bx-x-circle", color: "var(--dash-danger)" },
}

function ActSection({ stage, onUploadAct }: {
  stage: SpecialistOrderStage
  onUploadAct: (stageId: string, file: File) => Promise<{ success: boolean; error?: string }>
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = stage.act
  if (!act) return null

  const statusInfo = ACT_STATUS_LABEL[act.status] ?? { label: act.status, icon: "bx bx-file-blank", color: "var(--dash-muted)" }
  const canUpload = stage.status === "APPROVED" && (act.status === "PENDING" || act.status === "REJECTED")

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Загрузите файл в формате PDF")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Размер файла не должен превышать 50МБ")
      return
    }

    setUploading(true)
    setError(null)
    const result = await onUploadAct(stage.id, file)
    setUploading(false)

    if (!result.success) {
      setError(result.error || "Ошибка загрузки")
    }

    e.target.value = ""
  }

  return (
    <div style={{
      marginTop: 8,
      padding: "12px 14px",
      borderRadius: 8,
      background: act.status === "REJECTED" ? "rgba(234,84,85,0.06)" : act.status === "CONFIRMED" ? "rgba(46,184,92,0.06)" : "var(--dash-surface)",
      border: act.status === "REJECTED" ? "1px solid rgba(234,84,85,0.2)" : act.status === "CONFIRMED" ? "1px solid rgba(46,184,92,0.2)" : "1px solid var(--dash-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <i className={`bx ${statusInfo.icon}`} style={{ fontSize: "1.1rem", color: statusInfo.color }} />
        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--dash-text)" }}>
          Акт по этапу
        </span>
        <span style={{ fontSize: "0.75rem", color: statusInfo.color, fontWeight: 500 }}>
          {statusInfo.label}
        </span>
      </div>

      {act.status === "REJECTED" && act.adminApprovedAt && (
        <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(234,84,85,0.1)", fontSize: "0.78rem", color: "var(--dash-danger)" }}>
          <i className="bx bx-info-circle" style={{ marginRight: 4 }} />
          Акт требует доработки
        </div>
      )}

      {canUpload && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: "none" }}
            id={`act-upload-${stage.id}`}
          />
          <label
            htmlFor={`act-upload-${stage.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--dash-border)",
              background: "var(--dash-surface)",
              color: "var(--dash-text)",
              fontSize: "0.82rem",
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <i className="bx bx-upload" />
            {uploading ? "Загрузка..." : "Загрузить акт (PDF)"}
          </label>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(234,84,85,0.1)", fontSize: "0.78rem", color: "var(--dash-danger)" }}>
          <i className="bx bx-error-circle" style={{ marginRight: 4 }} />
          {error}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--dash-muted)" }}>
        {act.specialistActS3Key && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <i className="bx bx-file-pdf" style={{ color: "#e74c3c", fontSize: "0.9rem" }} />
            <span>Акт от дизайнера</span>
            <a
              href={`/api/stages/${stage.id}/act/download`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--dash-accent)", textDecoration: "none", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}
            >
              <i className="bx bx-download" />
              Скачать
            </a>
            <span style={{ color: "var(--dash-muted)", fontSize: "0.7rem" }}>
              {formatDate(act.specialistUploadedAt)}
            </span>
          </div>
        )}
        {act.clientActS3Key && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <i className="bx bx-file-pdf" style={{ color: "#27ae60", fontSize: "0.9rem" }} />
            <span>Акт от заказчика</span>
            <a
              href={`/api/stages/${stage.id}/act/download`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--dash-success)", textDecoration: "none", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}
            >
              <i className="bx bx-download" />
              Скачать
            </a>
            <span style={{ color: "var(--dash-muted)", fontSize: "0.7rem" }}>
              {formatDate(act.clientSignedAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const STAGE_RULES: Record<string, { title: string; items: string[] }> = {
  CONCEPT: {
    title: "Правила разработки концепции",
    items: [
      "ВНИМАТЕЛЬНО изучите бриф заказчика: оценить полноту заполнение брифа",
      "Изучите предоставленный план, определить ограничения (например, несущие стены)",
      "Изучите контекст: расположение, климат, виды из окон, историю места, культуру или личные истории клиента",
      "Изучите референсы, полученные от заказчика",
      "Задайте уточняющие вопросы, если необходимо",
      "Проанализируйте собранные данные: определите ключевые зоны, учтите эргономику, пропорции пространства, сохраняйте цветовой баланс, не перегружайте материалами и декором",
      "Создайте не менее 3-х moodboard (концепт-борд): коллаж с палитрой цветов, текстурами, формами мебели, примерами материалов и фото-референсами",
      "Загрузите файлы и прикрепите видео с записью экрана, на котором в течение 1-ой минуты для каждого варианта, объясняете идею",
      "Отправьте загруженные файлы администратору на модерацию",
      "Если администратор даст комментарии к вашей работе, то внесите доработки и отправьте файлы повторно",
      "Если от заказчика поступят правки, то внесите доработки и отправьте файлы повторно",
      "После согласования с заказчиком концепции переходите к разработке планировочных решений",
    ],
  },
}

function ConceptRules({ stageType }: { stageType: string }) {
  const [open, setOpen] = useState(false)
  const rules = STAGE_RULES[stageType]
  if (!rules) return null
  return (
    <div style={{ marginBottom: 12, borderRadius: 8, border: "1px solid var(--dash-border)", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--dash-surface2)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, color: "var(--dash-text)", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bx bx-book-open" style={{ color: "var(--dash-accent)", fontSize: "1rem" }} />
          {rules.title}
        </span>
        <i className={`bx ${open ? "bx-chevron-up" : "bx-chevron-down"}`} style={{ color: "var(--dash-muted)" }} />
      </button>
      {open && (
        <ol style={{ margin: 0, padding: "10px 12px 10px 28px", fontSize: "0.8rem", color: "var(--dash-text2)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 4 }}>
          {rules.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      )}
    </div>
  )
}

export type SpecialistOrderStage = {
  id: string
  type: StageType
  label: string
  status: string
  modRound: number
  clientRound: number
  rulesS3Key?: string | null
  rulesSentAt?: string | null
  rulesSentS3Key?: string | null
  rulesAckAt?: string | null
  rulesAckS3Key?: string | null
  files: Array<{
    id: string
    filename: string
    createdAt: string
    uploadedAt?: string
    hasAnnotations?: boolean
    audience?: "DESIGNER" | "CLIENT" | "SHARED"
  }>
  reviews: Array<{ id: string; reviewerRole: string; verdict: string; comment: string | null; createdAt: string }>
  act: {
    id: string
    signedAt: string | null
    signedById: string | null
    status: string
    generatedAt: string
    specialistActS3Key: string | null
    clientActS3Key: string | null
    specialistUploadedAt: string | null
    adminApprovedAt: string | null
    clientSignedAt: string | null
    adminConfirmedAt: string | null
  } | null
  extraPayments?: Array<{ id: string; amount: number; reason: string; status: string }>
}

export function SpecialistStageWorkBody({
  stage,
  isUploadTarget,
  canUploadToStage,
  onPreviewMedia,
  onSubmitStage,
  onUploadAct,
}: {
  stage: SpecialistOrderStage
  isUploadTarget: boolean
  canUploadToStage: boolean
  onPreviewMedia: (args: { stageId: string; fileId: string; filename: string; url: string }) => void
  onSubmitStage: (stageId: string) => Promise<{ ok: boolean; error?: string; status?: string }>
  onUploadAct: (stageId: string, file: File) => Promise<{ success: boolean; error?: string }>
}) {
  const isWaiting = ["MOD_REVIEW", "CLIENT_REVIEW"].includes(stage.status)
  const [view, setView] = useState<"comments" | "fixes">("comments")
  const [expandVariantMedia, setExpandVariantMedia] = useState<Record<number, boolean>>({})
  const [expandWaveMedia, setExpandWaveMedia] = useState<Record<number, boolean>>({})
  const [expandDraftMedia, setExpandDraftMedia] = useState(false)

  useEffect(() => {
    setExpandVariantMedia({})
    setExpandWaveMedia({})
    setExpandDraftMedia(false)
  }, [stage.id])

  const revisionVariants = useMemo(
    () => buildClientRevisionVariants(stage as Pick<OrderStage, "files" | "reviews">),
    [stage.files, stage.reviews],
  )
  const multiRound = revisionVariants.length > 1
  const lastVariantIdx = revisionVariants.length - 1

  const { waves, pendingDraft } = useMemo(
    () =>
      buildAdminStageReleaseWaves({
        status: stage.status,
        files: stage.files,
        reviews: stage.reviews,
      }),
    [stage.status, stage.files, stage.reviews],
  )
  const showWaveLayout = waves.length > 0 || pendingDraft != null

  const firstSendAt = useMemo(() => {
    const times = (stage.files ?? [])
      .map((f) => specialistFileTimeIso(f))
      .filter(Boolean)
      .map((t) => +new Date(t))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (times.length === 0) return null
    return new Date(Math.min(...times)).toISOString()
  }, [stage.files])

  const firstSendFiles = useMemo(() => {
    if (showWaveLayout) return (waves[0]?.files ?? []) as SpecialistOrderStage["files"]
    return (revisionVariants[0]?.files ?? []) as SpecialistOrderStage["files"]
  }, [showWaveLayout, waves, revisionVariants])

  const firstSendMedia = useMemo(() => {
    return firstSendFiles.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename)).slice(0, 6)
  }, [firstSendFiles])

  const firstSendDocs = useMemo(() => {
    return firstSendFiles.filter((f) => !(isStageImageFilename(f.filename) || isVideoFilename(f.filename)))
  }, [firstSendFiles])

  const latestReviewBy = useCallback((who: "MODERATOR" | "CLIENT") => {
    const list = (stage.reviews ?? [])
      .filter((r) => r.reviewerRole === who)
      .slice()
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return list[0] ?? null
  }, [stage.reviews])

  const latestModeratorReview = latestReviewBy("MODERATOR")
  const latestClientReview = latestReviewBy("CLIENT")
  const latestModeratorAt = latestModeratorReview ? +new Date(latestModeratorReview.createdAt) : null
  const latestClientAt = latestClientReview ? +new Date(latestClientReview.createdAt) : null
  const clientRevisionApprovedByAdmin =
    stage.status === "CLIENT_REVISION" &&
    latestClientReview?.verdict === "REJECTED" &&
    latestModeratorReview?.verdict === "APPROVED" &&
    latestModeratorAt != null &&
    latestClientAt != null &&
    latestModeratorAt >= latestClientAt

  const renderSpecialistFileRows = (vf: SpecialistOrderStage["files"]) =>
    vf.map((f, idx) => {
      const file = f
      return (
        <div key={file.id} className="dash-file-list__item">
          <span style={{ fontSize: "0.65rem", color: "var(--dash-muted)", fontWeight: 600, minWidth: 18 }}>
            #{vf.length - idx}
          </span>
          <a href={`/api/stages/${stage.id}/files/${file.id}/download`} target="_blank" rel="noreferrer" className="dash-file-link">
            <i className="bx bx-paperclip" />
            {file.filename}
          </a>
          <span style={{ fontSize: "0.62rem", color: "var(--dash-muted)", marginLeft: 4, whiteSpace: "nowrap" }}>
            {(() => {
              const t = specialistFileTimeIso(file)
              return t
                ? new Date(t).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "—"
            })()}
          </span>
          {file.hasAnnotations ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: "0.68rem",
                color: "var(--dash-warn, #ff9f43)",
                marginLeft: 6,
              }}
              title="Есть пометки от заказчика"
            >
              <i className="bx bx-note" />
              пометки
            </span>
          ) : null}
          <FileAudienceBadge audience={file.audience} />
        </div>
      )
    })

  const annotatedFiles = useMemo(() => {
    return (stage.files ?? [])
      .filter((f) => Boolean(f.hasAnnotations) && isStageImageFilename(f.filename))
      .map((f) => ({
        id: f.id,
        filename: f.filename,
        url: `/api/stages/${stage.id}/files/${f.id}/download`,
      }))
  }, [stage.files, stage.id])

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {([
          { key: "comments", label: "Комментарии" },
          { key: "fixes", label: annotatedFiles.length > 0 ? `Правки (пометки) · ${annotatedFiles.length}` : "Правки (пометки)" },
        ] as const).map((t) => {
          const active = view === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${active ? "var(--dash-accent-border)" : "var(--dash-border)"}`,
                background: active ? "var(--dash-accent-bg)" : "var(--dash-surface2)",
                color: active ? "var(--dash-accent)" : "var(--dash-text2)",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {view === "fixes" ? (
        <div style={{ marginBottom: 12 }}>
          {annotatedFiles.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "var(--dash-muted)" }}>
              Пока нет пометок на изображениях от заказчика.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {annotatedFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url: f.url })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--dash-border)",
                    background: "var(--dash-surface2)",
                    color: "var(--dash-text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                  title="Открыть пометки на изображении"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <i className="bx bx-note" style={{ color: "var(--dash-warn)" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: "0.78rem", color: "var(--dash-accent)", fontWeight: 700 }}>
                    Открыть →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {view === "fixes" ? null : (
        <>
      {/* “Сводка” как в админке: статусы/правки/одобрения */}
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        {firstSendAt ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--dash-border)", background: "var(--dash-surface2)" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--dash-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Первая отправка
            </div>
            <div style={{ marginTop: 4, fontSize: "0.82rem", color: "var(--dash-text)" }}>
              {new Date(firstSendAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ marginTop: 10 }}>
              {firstSendMedia.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginBottom: firstSendDocs.length > 0 ? 8 : 0 }}>
                  {firstSendMedia.map((f) => (
                    <FileThumbnail
                      key={`fs-media-${f.id}`}
                      stageId={stage.id}
                      file={{ id: f.id, filename: f.filename, createdAt: specialistFileTimeIso(f) || new Date(0).toISOString() }}
                      onClick={(url) => onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url })}
                    />
                  ))}
                </div>
              ) : null}

              {firstSendDocs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {firstSendDocs.map((f) => (
                    <a
                      key={`fs-doc-${f.id}`}
                      href={`/api/stages/${stage.id}/files/${f.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="dash-file-link"
                      style={{ fontSize: "0.82rem" }}
                    >
                      <i className="bx bx-paperclip" />
                      {f.filename}
                    </a>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: 8, fontSize: "0.75rem", color: "var(--dash-muted)" }}>
                Файлов в первой отправке: {firstSendFiles.length}
              </div>
            </div>
          </div>
        ) : null}

        {pendingDraft?.moderatorRejections?.length ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(245, 158, 11, 0.35)", background: "rgba(245, 158, 11, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <i className="bx bx-error-circle" style={{ color: "var(--dash-warn)" }} />
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--dash-warn)" }}>
                Правки администратора (нужно доработать)
              </div>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--dash-text)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
              {(pendingDraft.moderatorRejections[0]?.comment ?? "").trim() || "Комментарий не заполнен"}
            </div>
          </div>
        ) : null}

        {latestModeratorReview?.verdict === "APPROVED" ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(34, 197, 94, 0.35)", background: "rgba(34, 197, 94, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bx bx-check-circle" style={{ color: "var(--dash-success)" }} />
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--dash-success)" }}>
                Одобрено администратором
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--dash-muted)" }}>
                {new Date(latestModeratorReview.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ) : null}

        {latestClientReview?.verdict === "REJECTED" || stage.status === "CLIENT_REVISION" ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(56, 189, 248, 0.35)", background: "rgba(56, 189, 248, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className="bx bx-revision" style={{ color: "rgba(56, 189, 248, 0.95)" }} />
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "rgba(56, 189, 248, 0.95)" }}>
                  {clientRevisionApprovedByAdmin ? "Правки от заказчика (подтверждены админом)" : "Правки от заказчика"}
                </div>
              </div>
              {annotatedFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setView("fixes")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(56, 189, 248, 0.45)",
                    background: "rgba(56, 189, 248, 0.12)",
                    color: "rgba(56, 189, 248, 0.95)",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    fontFamily: "inherit",
                  }}
                >
                  Открыть пометки →
                </button>
              ) : null}
            </div>
            {latestClientReview?.comment?.trim() ? (
              <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--dash-text)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {latestClientReview.comment.trim()}
              </div>
            ) : null}
            {annotatedFiles.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                  {annotatedFiles.slice(0, 6).map((f) => (
                    <FileThumbnail
                      key={`ann-${f.id}`}
                      stageId={stage.id}
                      file={{ id: f.id, filename: f.filename, createdAt: new Date(0).toISOString() }}
                      onClick={(url) => onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url })}
                    />
                  ))}
                </div>
                {annotatedFiles.length > 6 ? (
                  <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--dash-muted)" }}>
                    Ещё файлов с пометками: {annotatedFiles.length - 6}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {stage.rulesS3Key && (
        <div className="dash-badge" style={{ marginBottom: 8, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i className="bx bx-book-open" />
            <a
              href={`/api/stages/${stage.id}/rules`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Правила этапа (скачать)
            </a>
          </span>

          {stage.rulesSentAt ? (
            (() => {
              const same = stage.rulesAckS3Key && stage.rulesS3Key ? stage.rulesAckS3Key === stage.rulesS3Key : false
              const label = same ? "Ознакомлен" : "Нужно ознакомиться"
              const color = same ? "var(--dash-success)" : "var(--dash-warn)"
              const border = same ? "rgba(34,197,94,0.45)" : "rgba(245,158,11,0.45)"
              const bg = same ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)"

              return (
                <>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color, border: `1px solid ${border}`, background: bg, padding: "3px 10px", borderRadius: 999 }}>
                    {label}
                  </span>
                  {!same ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch(`/api/stages/${stage.id}/rules/ack`, { method: "POST" })
                          location.reload()
                        } catch {
                          // ignore
                        }
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        color: "var(--dash-text)",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        fontFamily: "inherit",
                      }}
                    >
                      Ознакомился
                    </button>
                  ) : null}
                </>
              )
            })()
          ) : null}
        </div>
      )}

      {stage.modRound > 0 && (
        <div className="dash-stage-card__meta">
          Модерация: {stage.modRound}/1 бесплатных · Клиент:{" "}
          {stage.clientRound}/{MAX_FREE_CLIENT_REVISIONS} бесплатных
        </div>
      )}

      {showWaveLayout ? (
        <>
          {waves.map((w, wIdx) => {
            const vf = w.files as SpecialistOrderStage["files"]
            const hasContext =
              vf.length > 0 ||
              w.moderatorRejections.length > 0 ||
              w.clientRejections.length > 0
            if (!hasContext) return null

            const waveMulti = waves.length > 1
            const lastWIdx = waves.length - 1
            const isPastRound = waveMulti && wIdx < lastWIdx
            const isLastWave = wIdx === lastWIdx
            const vMedia = vf.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename))
            const mediaExpanded = expandWaveMedia[wIdx] ?? false
            const shownVMedia = mediaExpanded ? vMedia : vMedia.slice(0, 12)

            const heading =
              waveMulti ? `Выпуск ${w.displayNumber} из ${waves.length}` : `Файлы (${vf.length})`

            const marginBottom =
              waveMulti && wIdx < lastWIdx ? 12 : pendingDraft ? 12 : 0

            return (
              <div
                key={`spec-wave-${stage.id}-${w.waveIndex}`}
                className="dash-file-list"
                style={{
                  marginBottom,
                  padding: waveMulti ? "12px 12px 10px" : undefined,
                  borderRadius: waveMulti ? 10 : undefined,
                  border: waveMulti
                    ? `1.5px ${isPastRound ? "dashed" : "solid"} ${
                        isPastRound
                          ? "var(--dash-border)"
                          : stage.status === "APPROVED" && isLastWave && w.isFinalAcceptedBundle
                            ? "var(--dash-success)"
                            : "var(--dash-accent-border, var(--dash-accent))"
                      }`
                    : undefined,
                  background: waveMulti
                    ? isPastRound
                      ? "var(--dash-surface2)"
                      : stage.status === "APPROVED" && isLastWave && w.isFinalAcceptedBundle
                        ? "rgba(46,184,92,0.06)"
                        : "var(--dash-surface)"
                    : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="dash-file-list__title" style={{ marginBottom: waveMulti ? 0 : 4 }}>
                      {heading}
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "var(--dash-muted)", margin: 0, fontWeight: 500 }}>
                      Отправлено заказчику · {formatWaveDt(w.releasedAt)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                        Принято заказчиком
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
                        Ваша доработка
                      </span>
                    )}
                  </div>
                </div>

                {isPastRound ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--dash-muted)", margin: "0 0 10px", lineHeight: 1.45 }}>
                    Предыдущий выпуск к заказчику.
                  </p>
                ) : null}

                {w.moderatorRejections.length > 0 ? (
                  <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: "3px solid rgba(245, 158, 11, 0.9)" }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dash-muted)", margin: "0 0 6px" }}>
                      Модератор до выпуска
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.45, color: "var(--dash-text)" }}>
                      {w.moderatorRejections.map((x, i) => (
                        <li key={`sm-${w.waveIndex}-${i}`}>
                          {x.comment?.trim() ? x.comment : "(без текста)"}
                          <span style={{ color: "var(--dash-muted)", marginLeft: 6 }}>{formatWaveDt(x.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {w.clientRejections.length > 0 ? (
                  <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: "3px solid rgba(56, 189, 248, 0.95)" }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dash-muted)", margin: "0 0 6px" }}>
                      Заказчик до выпуска
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.45, color: "var(--dash-text)" }}>
                      {w.clientRejections.map((x, i) => (
                        <li key={`sc-${w.waveIndex}-${i}`}>
                          {x.comment?.trim() ? x.comment : "(без текста)"}
                          <span style={{ color: "var(--dash-muted)", marginLeft: 6 }}>{formatWaveDt(x.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {vMedia.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                      {shownVMedia.map((f) => (
                        <FileThumbnail
                          key={f.id}
                          stageId={stage.id}
                          file={{
                            id: f.id,
                            filename: f.filename,
                            createdAt: specialistFileTimeIso(f) || new Date(0).toISOString(),
                          }}
                          onClick={(url) => {
                            onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url })
                          }}
                        />
                      ))}
                    </div>
                    {vMedia.length > 12 && (
                      <button
                        type="button"
                        onClick={() => setExpandWaveMedia((prev) => ({ ...prev, [wIdx]: !mediaExpanded }))}
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

                {renderSpecialistFileRows(vf)}
              </div>
            )
          })}

          {pendingDraft &&
          (pendingDraft.files.length > 0 || pendingDraft.moderatorRejections.length > 0) ? (
            <div
              className="dash-file-list"
              style={{
                marginBottom: 0,
                padding: "12px 12px 10px",
                borderRadius: 10,
                border: "1.5px dashed var(--dash-border)",
                background: "var(--dash-surface2)",
              }}
            >
              <p className="dash-file-list__title" style={{ marginBottom: 4 }}>
                Черновик
              </p>
              <p style={{ fontSize: "0.72rem", color: "var(--dash-muted)", margin: "0 0 10px", lineHeight: 1.45 }}>
                После последнего выпуска — ещё не утверждено для показа заказчику
              </p>

              {pendingDraft.moderatorRejections.length > 0 ? (
                <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: "3px solid rgba(245, 158, 11, 0.9)" }}>
                  <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dash-muted)", margin: "0 0 6px" }}>
                    Модератор (текущая доработка)
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.45, color: "var(--dash-text)" }}>
                    {pendingDraft.moderatorRejections.map((x, i) => (
                      <li key={`pd-m-${i}`}>
                        {x.comment?.trim() ? x.comment : "(без текста)"}
                        <span style={{ color: "var(--dash-muted)", marginLeft: 6 }}>{formatWaveDt(x.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(pendingDraft.bundles?.length
                ? pendingDraft.bundles
                : pendingDraft.files.length > 0
                  ? [{ bundleIndex: 0, label: "Файлы", files: pendingDraft.files, moderatorRejection: null }]
                  : []).map((b) => {
                const vf = b.files as SpecialistOrderStage["files"]
                const isRejected = Boolean(b.moderatorRejectedAt || b.moderatorRejection)
                const isCurrent = !isRejected

                const vMedia = vf.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename))
                const shownVMedia = expandDraftMedia ? vMedia : vMedia.slice(0, 12)

                return (
                  <div key={`spec-pd-b-${b.bundleIndex}`} style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--dash-text)" }}>
                        {b.label} <span style={{ color: "var(--dash-muted)", fontWeight: 600 }}>· {vf.length}</span>
                      </div>
                      {isRejected ? (
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--dash-danger)", padding: "3px 10px", borderRadius: 999, background: "rgba(234,84,85,0.10)", border: "1px solid rgba(234,84,85,0.30)" }}>
                          Отклонено
                        </span>
                      ) : isCurrent ? (
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--dash-warn)", padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}>
                          Ожидает проверки
                        </span>
                      ) : null}
                    </div>

                    {vMedia.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                          {shownVMedia.map((f) => (
                            <FileThumbnail
                              key={f.id}
                              stageId={stage.id}
                              file={{
                                id: f.id,
                                filename: f.filename,
                                createdAt: specialistFileTimeIso(f) || new Date(0).toISOString(),
                              }}
                              onClick={(url) => onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url })}
                            />
                          ))}
                        </div>
                        {vMedia.length > 12 && (
                          <button
                            type="button"
                            onClick={() => setExpandDraftMedia((v) => !v)}
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
                            {expandDraftMedia ? "Свернуть" : `Показать ещё (${vMedia.length - 12})`}
                          </button>
                        )}
                      </div>
                    )}

                    {renderSpecialistFileRows(vf)}

                    {isRejected && b.moderatorRejection ? (
                      <div style={{ marginTop: 10, paddingLeft: 10, borderLeft: "3px solid rgba(234,84,85,0.65)" }}>
                        <p style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--dash-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Причина отклонения
                        </p>
                        <div style={{ fontSize: "0.82rem", color: "var(--dash-text)", lineHeight: 1.45 }}>
                          {b.moderatorRejection.comment?.trim() ? b.moderatorRejection.comment : "(без текста)"}
                          <span style={{ color: "var(--dash-muted)", marginLeft: 6 }}>
                            {formatWaveDt(b.moderatorRejection.createdAt)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </>
      ) : (
        revisionVariants.some((v) => v.files.length > 0) &&
          revisionVariants.map((variant, vIdx) => {
            const vf = variant.files
            if (vf.length === 0) return null

            const isPastRound = multiRound && vIdx < lastVariantIdx
            const isLastVariant = vIdx === lastVariantIdx
            const vMedia = vf.filter((f) => isStageImageFilename(f.filename) || isVideoFilename(f.filename))
            const mediaExpanded = expandVariantMedia[vIdx] ?? false
            const shownVMedia = mediaExpanded ? vMedia : vMedia.slice(0, 12)

            const heading = multiRound ? `Вариант ${variant.displayRound} из ${revisionVariants.length}` : `Файлы (${vf.length})`

            return (
              <div
                key={`spec-variant-${stage.id}-${variant.variantIndex}`}
                className="dash-file-list"
                style={{
                  marginBottom: vIdx < lastVariantIdx ? 12 : 0,
                  padding: multiRound ? "12px 12px 10px" : undefined,
                  borderRadius: multiRound ? 10 : undefined,
                  border: multiRound
                    ? `1.5px ${isPastRound ? "dashed" : "solid"} ${
                        isPastRound
                          ? "var(--dash-border)"
                          : stage.status === "APPROVED" && isLastVariant
                            ? "var(--dash-success)"
                            : "var(--dash-accent-border, var(--dash-accent))"
                      }`
                    : undefined,
                  background: multiRound
                    ? isPastRound
                      ? "var(--dash-surface2)"
                      : stage.status === "APPROVED" && isLastVariant
                        ? "rgba(46,184,92,0.06)"
                        : "var(--dash-surface)"
                    : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <p className="dash-file-list__title" style={{ marginBottom: 0 }}>
                    {heading}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {multiRound && isLastVariant && stage.status === "APPROVED" && (
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
                        Принято заказчиком
                      </span>
                    )}
                    {multiRound && isLastVariant && stage.status === "CLIENT_REVIEW" && (
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
                    {multiRound && isLastVariant && stage.status === "CLIENT_REVISION" && (
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
                        Ваша доработка
                      </span>
                    )}
                  </div>
                </div>

                {isPastRound ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--dash-muted)", margin: "0 0 10px", lineHeight: 1.45 }}>
                    Предыдущая сдача. Заказчик запросил правки — см. замечания ниже.
                  </p>
                ) : null}

                {variant.revisionFeedback ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--dash-surface2)",
                      borderLeft: "3px solid var(--dash-warn)",
                    }}
                  >
                    <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--dash-muted)", margin: "0 0 4px" }}>
                      Замечания заказчика к этой версии
                    </p>
                    <p style={{ fontSize: "0.82rem", color: "var(--dash-text)", margin: 0, whiteSpace: "pre-wrap" }}>
                      {variant.revisionFeedback}
                    </p>
                  </div>
                ) : null}

                {vMedia.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                      {shownVMedia.map((f) => (
                        <FileThumbnail
                          key={f.id}
                          stageId={stage.id}
                          file={{
                            id: f.id,
                            filename: f.filename,
                            createdAt: specialistFileTimeIso(f) || new Date(0).toISOString(),
                          }}
                          onClick={(url) => {
                            onPreviewMedia({ stageId: stage.id, fileId: f.id, filename: f.filename, url })
                          }}
                        />
                      ))}
                    </div>
                    {vMedia.length > 12 && (
                      <button
                        type="button"
                        onClick={() => setExpandVariantMedia((prev) => ({ ...prev, [vIdx]: !mediaExpanded }))}
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

                {renderSpecialistFileRows(vf as SpecialistOrderStage["files"])}
              </div>
            )
          })
      )}

      {!multiRound && stage.reviews.length > 0 && stage.reviews[0].comment ? (
        <div className={`dash-review-note${stage.reviews[0].verdict === "APPROVED" ? " dash-review-note--ok" : ""}`}>
          <p className="dash-review-note__by">
            {stage.reviews[0].reviewerRole === "MODERATOR" ? "Модератор" : "Заказчик"}
          </p>
          <p className="dash-review-note__text">{stage.reviews[0].comment}</p>
        </div>
      ) : null}

      {isUploadTarget && canUploadToStage && (
        <div className="dash-upload-wrap">
          <ConceptRules stageType={stage.type} />
          <StageUpload
            stageId={stage.id}
            canUpload={true}
            stageType={stage.type}
            submitStage={onSubmitStage}
          />
        </div>
      )}

      {stage.extraPayments && stage.extraPayments.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(234,84,85,0.06)", border: "1px solid rgba(234,84,85,0.15)", marginTop: 8 }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--dash-danger, #ea5455)" }}>
            <i className="bx bx-receipt" style={{ marginRight: 4 }} />Дополнительные правки
          </p>
          {stage.extraPayments.map(ep => (
            <div key={ep.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "2px 0" }}>
              <span style={{ color: "var(--dash-muted)" }}>{ep.reason}</span>
              <span style={{ fontWeight: 600, color: ep.status === "PENDING" ? "var(--dash-warn)" : ep.status === "HELD" ? "var(--dash-accent)" : "var(--dash-success)" }}>
                {(ep.amount / 100).toLocaleString("ru-RU")} руб. — {ep.status === "PENDING" ? "Ожидает оплаты" : ep.status === "HELD" ? "Оплачено" : ep.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {isWaiting && (
        <div className="dash-waiting-note">
          <i className="bx bx-time-five" />Ожидайте результата проверки
        </div>
      )}

      {stage.status === "APPROVED" && stage.act && (
        <ActSection stage={stage} onUploadAct={onUploadAct} />
      )}
        </>
      )}
    </>
  )
}
