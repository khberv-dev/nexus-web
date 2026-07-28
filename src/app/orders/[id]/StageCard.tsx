"use client"

import { useEffect, useMemo, useState } from "react"
import { MAX_FREE_CLIENT_REVISIONS } from "@/lib/stage-constants"
import { OrderStage, STAGE_LABEL, STAGE_STATUS, type StageAct } from "./types"
import { isStagePaymentsDisabledPublic } from "@/lib/payments/flags"
import { FilePreviewModal } from "./stage-card/FilePreviewModal"
import { StageMaterialsSection } from "./stage-card/StageMaterialsSection"
import { StagePaymentSection } from "./stage-card/StagePaymentSection"
import { StageClientActionsSection } from "./stage-card/StageClientActionsSection"
import { StageExtraPaymentSection } from "./stage-card/StageExtraPaymentSection"
import { StageActSection } from "./stage-card/StageActSection"

export function StageCard({ stage, onAction, onActSigned, embedded, onOpenRevisionChat, revisionViaChatOnly }: {
  stage: OrderStage
  onAction: (stageId: string, action: "clientApprove" | "clientRevision", comment?: string) => Promise<void>
  onActSigned?: (stageId: string, signedAt: string) => void
  /** Без якоря и отступа — внутри обёртки с чатом */
  embedded?: boolean
  /** Вызывается при «На доработку» до показа формы (прокрутка/фокус чата у родителя). */
  onOpenRevisionChat?: () => void
  /** Не показывать отдельное поле замечаний — текст только в чате (шторка у родителя). */
  revisionViaChatOnly?: boolean
}) {
  const [acting, setActing] = useState(false)
  const [showRevision, setShowRevision] = useState(false)
  const [comment, setComment] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFilename, setPreviewFilename] = useState("")
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [previewFromArchive, setPreviewFromArchive] = useState(false)
  const [expandVariantMedia, setExpandVariantMedia] = useState<Record<number, boolean>>({})
  const [expandWaveMedia, setExpandWaveMedia] = useState<Record<number, boolean>>({})
  const [actUploading, setActUploading] = useState(false)
  const [actUploadError, setActUploadError] = useState<string | null>(null)
  const [actLocalOverride, setActLocalOverride] = useState<StageAct | null>(null)

  useEffect(() => {
    setActLocalOverride(null)
    setActUploadError(null)
  }, [stage.id, stage.act?.clientSignedAt, stage.act?.clientActS3Key, stage.act?.status, stage.act?.signedAt])

  useEffect(() => {
    setExpandVariantMedia({})
    setExpandWaveMedia({})
  }, [stage.id])

  const effectiveAct = actLocalOverride ?? stage.act ?? null
  const clientActSubmitted = Boolean(
    effectiveAct?.clientActS3Key || effectiveAct?.clientSignedAt || effectiveAct?.signedAt
  )
  const clientCanUploadSignedAct = Boolean(
    effectiveAct && effectiveAct.status === "ADMIN_APPROVED" && !effectiveAct.clientActS3Key,
  )

  const isClientReview = stage.status === "CLIENT_REVIEW"
  const st = STAGE_STATUS[stage.status]
  const skipPayments = isStagePaymentsDisabledPublic()

  const handleApprove = async () => { setActing(true); await onAction(stage.id, "clientApprove"); setActing(false) }
  const handleRevision = async () => {
    setActing(true)
    const text = revisionViaChatOnly ? undefined : (comment.trim() || undefined)
    await onAction(stage.id, "clientRevision", text)
    setActing(false)
    setShowRevision(false)
    setComment("")
  }

  const handlePayment = async () => {
    setActing(true)
    try {
      const res = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: stage.id }),
      })
      if (res.ok) {
        const { paymentUrl } = await res.json()
        if (paymentUrl) window.location.href = paymentUrl
      } else {
        const err = await res.json()
        alert(err.error || "Ошибка инициализации платежа")
      }
    } catch (e) {
      console.error(e)
      alert("Не удалось связаться с сервисом оплаты")
    } finally {
      setActing(false)
    }
  }

  return (
    <div style={{
      border: `1.5px solid ${isClientReview ? "var(--dash-warn)" : "var(--dash-border)"}`,
      borderRadius: 12, padding: "1.25rem 1.5rem",
      background: isClientReview ? "var(--dash-warn-bg)" : "var(--dash-surface)",
      marginBottom: embedded ? 0 : "1rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--dash-text)" }}>{STAGE_LABEL[stage.type]}</span>
          {stage.clientRound > 0 && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "var(--dash-muted)" }}>
              (правки: {stage.clientRound}/{MAX_FREE_CLIENT_REVISIONS})
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.78rem", fontWeight: 500, color: st.color }}>{st.label}</span>
      </div>

      {stage.rulesS3Key ? (
        <div style={{ marginBottom: 10 }}>
          <a
            href={`/api/stages/${stage.id}/rules`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--dash-border)",
              background: "var(--dash-surface2)",
              color: "var(--dash-text)",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <i className="bx bx-book-open" style={{ color: "var(--dash-accent)" }} aria-hidden />
            Правила этапа (PDF)
          </a>
        </div>
      ) : null}

      <StageMaterialsSection
        stage={stage}
        expandVariantMedia={expandVariantMedia}
        setExpandVariantMedia={setExpandVariantMedia}
        expandWaveMedia={expandWaveMedia}
        setExpandWaveMedia={setExpandWaveMedia}
        onOpenPreview={({ url, filename, fileId, fromArchive }) => {
          setPreviewFromArchive(fromArchive)
          setPreviewUrl(url)
          setPreviewFilename(filename)
          setPreviewFileId(fileId)
        }}
      />

      {previewUrl && (
        <FilePreviewModal
          url={previewUrl}
          filename={previewFilename}
          stageId={stage.id}
          fileId={previewFileId}
          editable={isClientReview && !previewFromArchive}
          readonlyReason={
            previewFromArchive
              ? "Открыт архивный выпуск материалов. Редактировать пометки можно только на последней версии."
              : !isClientReview
                ? `Редактирование доступно только на статусе «Ожидает вашего решения». Сейчас статус этапа: «${st.label}».`
                : undefined
          }
          onClose={() => {
            setPreviewUrl(null)
            setPreviewFileId(null)
            setPreviewFilename("")
            setPreviewFromArchive(false)
          }}
        />
      )}

      {/* Last review */}
      {stage.reviews.length > 0 && stage.reviews[0].comment && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem", borderRadius: 8, background: "var(--dash-surface2)", borderLeft: "3px solid var(--dash-border)" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-muted)", marginBottom: "0.3rem" }}>Комментарий</p>
          <p style={{ fontSize: "0.85rem", color: "var(--dash-text)", margin: 0 }}>{stage.reviews[0].comment}</p>
        </div>
      )}

      {/* Awaiting payment */}
      {stage.status === "AWAITING_PAYMENT" && (
        <StagePaymentSection acting={acting} skipPayments={skipPayments} price={stage.price} onPay={handlePayment} />
      )}

      {/* Client actions */}
      <StageClientActionsSection
        stage={stage}
        acting={acting}
        showRevision={showRevision}
        setShowRevision={setShowRevision}
        comment={comment}
        setComment={setComment}
        onApprove={handleApprove}
        onRevision={handleRevision}
        onOpenRevisionChat={onOpenRevisionChat}
        revisionViaChatOnly={revisionViaChatOnly}
      />

      {/* Extra payment */}
      {stage.status === "EXTRA_PAYMENT" && (
        <StageExtraPaymentSection stage={stage} acting={acting} onPay={handlePayment} />
      )}

      {/* Free revisions */}
      {(stage.status === "CLIENT_REVIEW" || stage.status === "CLIENT_REVISION") &&
        stage.clientRound < MAX_FREE_CLIENT_REVISIONS && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dash-muted)" }}>
            Осталось бесплатных правок: {MAX_FREE_CLIENT_REVISIONS - stage.clientRound}
          </div>
        )}

      {/* Act signing: только после одобрения админом — см. /api/stages/.../act/client-sign */}
      {stage.status === "APPROVED" && effectiveAct && (
        <StageActSection
          stage={stage}
          effectiveAct={effectiveAct}
          clientActSubmitted={clientActSubmitted}
          clientCanUploadSignedAct={clientCanUploadSignedAct}
          actUploading={actUploading}
          actUploadError={actUploadError}
          setActUploading={setActUploading}
          setActUploadError={setActUploadError}
          onActUploaded={(act) => {
            setActLocalOverride(act)
            const at = act.clientSignedAt || act.signedAt
            if (at) onActSigned?.(stage.id, typeof at === "string" ? at : new Date(at).toISOString())
          }}
        />
      )}
    </div>
  )
}
