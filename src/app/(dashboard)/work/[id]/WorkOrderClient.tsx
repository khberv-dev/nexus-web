"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { isStageImageFilename } from "@/lib/stage-file-helpers"
import "@/components/Community/Community.css"
import { DashPageTitle } from "@/components/dashboard-ui/DashPageTitle"
import { DashMainLayout } from "@/components/dashboard-ui/DashMainLayout"
import { DashBriefCard } from "@/components/dashboard-ui/DashBriefCard"
import { DashInfoChip } from "@/components/dashboard-ui/DashInfoChip"
import { DashProgressCard } from "@/components/dashboard-ui/DashProgressCard"
import { DashSidebarNav } from "@/components/dashboard-ui/DashSidebarNav"
import { DashSurfaceCard } from "@/components/dashboard-ui/DashSurfaceCard"
import { DashTopHeader } from "@/components/dashboard-ui/DashTopHeader"
import { DashRightDrawer } from "@/components/dashboard-ui/DashRightDrawer"
import { OrderHistoryTimeline } from "@/components/dashboard-ui/OrderHistoryTimeline"
import { openOrderChat } from "@/components/dashboard-ui/OrderChatPanel"
import { ClientContractPanel } from "@/components/client/ClientContractPanel"
import { buildSpecialistCabinetNavItems, SPECIALIST_ROUTE_TABS } from "@/components/Community/specialist-route-tabs"
import { SPECIALIST_CABINET_LOGO_HREF } from "@/lib/cabinet-shell"
import type { StageType } from "@prisma/client"
import { OrderStagesGrid } from "@/components/app/OrderStagesGrid"
import type { OrderStage as PipelineOrderStage, StageStatus, StageType as ClientStageType } from "@/app/orders/[id]/types"
import { STAGE_LABEL, STAGE_STATUS as STAGE_STATUS_SHARED } from "@/app/orders/[id]/types"
import { stagePurpose, stageStatusGuidance } from "@/app/orders/[id]/work/stageGuidance"
import { getOrderBriefDisplayLabels } from "@/lib/order-brief-display"
import { SpecialistStageWorkBody } from "./SpecialistStageWorkBody"
import { stageStatusLabelForViewer } from "@/lib/stage-status-ui"

const StageImageMarkup = dynamic(() => import("@/components/stage/StageImageMarkup"), { ssr: false })

const SPECIALIST_ORDER_BRIEF_LABELS = getOrderBriefDisplayLabels()

const isVideoFilename = (name: string) => /\.(mp4|webm|mov)$/i.test(name.replace(/^🎬\s*/, ""))

function FilePreviewModal({
  url,
  filename,
  onClose,
  stageId,
  fileId,
  editable,
  readonlyReason,
}: {
  url: string
  filename: string
  onClose: () => void
  stageId: string
  fileId: string | null
  editable: boolean
  readonlyReason?: string
}) {
  const isVideo = isVideoFilename(filename)
  const isImage = isStageImageFilename(filename)
  const showMarkupViewer = isImage && fileId
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          position: "relative",
          overflowY: showMarkupViewer ? "auto" : undefined,
          overflowX: "hidden",
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: -36, right: 0, background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
        {showMarkupViewer ? (
          <StageImageMarkup stageId={stageId} fileId={fileId} filename={filename} editable={editable} readonlyReason={readonlyReason} onClose={onClose} />
        ) : (
          <>
            {isImage && <img src={url} alt={filename} style={{ maxWidth: "85vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, display: "block" }} />}
            {isVideo && <video src={url} controls autoPlay style={{ maxWidth: "85vw", maxHeight: "85vh", borderRadius: 8, display: "block" }} />}
            {!isImage && !isVideo && (
              <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "2rem 3rem", color: "#fff", textAlign: "center" }}>
                <i className="bx bx-file" style={{ fontSize: "3rem", marginBottom: 12, display: "block" }} />
                <p style={{ margin: "0 0 16px" }}>{filename}</p>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: "#6ee7b7", textDecoration: "none" }}>Скачать файл</a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type StageFile = { id: string; filename: string; createdAt: string; hasAnnotations?: boolean; audience?: "DESIGNER" | "CLIENT" | "SHARED" }
type StageReview = { id: string; reviewerRole: string; verdict: string; comment: string | null; createdAt: string }
type StageAct = {
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
}

/** После `NextResponse.json` даты — строки ISO; не вызывать `.toISOString()` вслепую. */
function toIsoStringOrNull(v: unknown): string | null {
  if (v == null || v === "") return null
  if (typeof v === "string") return v
  if (v instanceof Date) return v.toISOString()
  return null
}
type OrderStage = {
  id: string
  type: StageType
  label: string
  status: string
  modRound: number
  clientRound: number
  rulesS3Key?: string | null
  files: StageFile[]
  reviews: StageReview[]
  act: StageAct | null
  extraPayments?: { id: string; amount: number; reason: string; status: string }[]
}
type WorkOrder = {
  id: string
  status: string
  createdAt: string
  briefData: Record<string, string> | null
  client: { name: string | null; email: string }
  stages: OrderStage[]
  payments: { id: string; amount: number; status: string }[]
  contract: {
    id: string
    number: string
    status: string
    s3Key: string | null
    specialistSignedS3Key: string | null
    clientSignedS3Key: string | null
    sentToSpecialistAt: string | null
    specialistSignedAt: string | null
    sentToClientAt: string | null
    clientSignedAt: string | null
    confirmedAt: string | null
  } | null
}

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Черновик", color: "var(--dash-warn)", bg: "var(--dash-warn-bg)" },
  BRIEFING: { label: "Заполнение брифа", color: "var(--dash-accent)", bg: "var(--dash-accent-bg)" },
  BRIEF_REVIEW: { label: "Бриф на проверке", color: "hsl(270,60%,65%)", bg: "hsla(270,60%,65%,0.12)" },
  ACTIVE: { label: "В работе", color: "var(--dash-success)", bg: "var(--dash-success-bg)" },
  DONE: { label: "Завершен", color: "var(--dash-muted)", bg: "var(--dash-border)" },
  CANCELLED: { label: "Отменен", color: "var(--dash-danger)", bg: "var(--dash-danger-bg)" },
}

function specialistStageStatusLabel(type: StageType, status: string): string {
  return stageStatusLabelForViewer({
    viewerRole: "SPECIALIST",
    stageType: type as never,
    status: status as StageStatus,
  })
}

export default function WorkOrderClient({
  order: initial,
  email,
  briefHelpRequested,
  pipelineStages,
  focusedStageType,
}: {
  order: WorkOrder
  email: string
  briefHelpRequested: boolean
  pipelineStages: PipelineOrderStage[]
  focusedStageType?: StageType
}) {
  const [order, setOrder] = useState(initial)
  const [briefFiles, setBriefFiles] = useState<Array<{ id: string; s3Key: string; filename: string; mimeType: string | null; size: number | null; createdAt: string }>>([])
  const [briefFilesLoaded, setBriefFilesLoaded] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFilename, setPreviewFilename] = useState("")
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [previewStageId, setPreviewStageId] = useState<string | null>(null)

  const openChat = useCallback(() => openOrderChat(initial.id, { focus: false, channel: "ADMIN_SPECIALIST" }), [initial.id])

  const st = ORDER_STATUS[order.status] ?? { label: order.status, color: "var(--dash-muted)", bg: "var(--dash-border)" }
  const shortId = order.id.slice(-6).toUpperCase()

  const activeStage = order.stages.find(s => !["APPROVED", "PENDING", "BLOCKED"].includes(s.status))
  const nextPendingStage = !activeStage ? order.stages.find((s, i) => {
    if (s.status !== "PENDING") return false
    if (i === 0) return true
    return order.stages[i - 1]?.status === "APPROVED"
  }) : null
  const uploadStage = activeStage ?? nextPendingStage
  const canUploadToStage = uploadStage ? ["PENDING", "UPLOADED", "MOD_REVISION", "CLIENT_REVISION"].includes(uploadStage.status) : false

  const approved = order.stages.filter(s => s.status === "APPROVED").length
  const total = order.stages.length

  const gridStages = useMemo(
    () =>
      pipelineStages.map(p => {
        const live = order.stages.find(o => o.id === p.id)
        return live ? { ...p, status: live.status as PipelineOrderStage["status"] } : p
      }),
    [pipelineStages, order.stages],
  )

  const focusedStage = focusedStageType ? order.stages.find(s => s.type === focusedStageType) ?? null : null

  const loadBriefFiles = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders/${order.id}/brief/files`)
      if (!r.ok) return
      const body = await r.json() as { files?: typeof briefFiles }
      setBriefFiles(Array.isArray(body.files) ? body.files : [])
      setBriefFilesLoaded(true)
    } catch {
      // ignore
    }
  }, [order.id])

  const handleSubmitStage = async (stageId: string): Promise<{ ok: boolean; error?: string; status?: string }> => {
    const res = await fetch(`/api/stages/${stageId}/submit`, { method: "POST" })
    const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string }
    if (!res.ok) {
      return { ok: false, error: body.error ?? `Ошибка ${res.status}` }
    }
    if (body.status) {
      setOrder(prev => ({
        ...prev,
        stages: prev.stages.map(s => (s.id === stageId ? { ...s, status: body.status! } : s)),
      }))
    }
    return { ok: true, status: body.status }
  }

  const handleUploadAct = async (stageId: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`/api/stages/${stageId}/act/upload`, { method: "POST", body: formData })
    if (res.ok) {
      const { act } = await res.json() as { act: Record<string, unknown> }
      setOrder(prev => ({
        ...prev,
        stages: prev.stages.map(s => s.id === stageId ? {
          ...s,
          act: {
            ...s.act!,
            ...act,
            generatedAt: toIsoStringOrNull(act.generatedAt) ?? s.act!.generatedAt,
            signedAt: toIsoStringOrNull(act.signedAt) ?? s.act!.signedAt,
            specialistUploadedAt: toIsoStringOrNull(act.specialistUploadedAt),
            adminApprovedAt: toIsoStringOrNull(act.adminApprovedAt),
            clientSignedAt: toIsoStringOrNull(act.clientSignedAt),
            adminConfirmedAt: toIsoStringOrNull(act.adminConfirmedAt),
          },
        } : s),
      }))
      return { success: true }
    }
    const err = await res.json()
    return { success: false, error: err.error || "Ошибка загрузки" }
  }

  const stageTitle = focusedStage ? STAGE_LABEL[focusedStage.type as ClientStageType] : ""
  const stageStatusLabel = focusedStage ? specialistStageStatusLabel(focusedStage.type, focusedStage.status) : ""

  const stageAbout =
    focusedStage ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dash-text2)", marginBottom: 6, letterSpacing: "0.02em" }}>
            Зачем этот этап
          </div>
          <div style={{ fontSize: "0.82rem", lineHeight: 1.55, color: "var(--dash-text)" }}>
            {stagePurpose(focusedStage.type as ClientStageType)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dash-text2)", marginBottom: 6, letterSpacing: "0.02em" }}>
            В этом статусе
          </div>
          <div style={{ fontSize: "0.82rem", lineHeight: 1.55, color: "var(--dash-text)" }}>
            {stageStatusGuidance(focusedStage.type as ClientStageType, focusedStage.status as StageStatus)}
          </div>
        </div>
      </div>
    ) : (
      "Этап не найден."
    )

  const headerPrimary = focusedStageType
    ? { href: `/work/${order.id}`, label: "К заказу", iconClassName: "bx bx-left-arrow-alt" }
    : { href: SPECIALIST_CABINET_LOGO_HREF, label: "Все проекты", iconClassName: "bx bx-grid-alt" }

  const headerChip = focusedStageType
    ? { label: `Прогресс ${approved}/${total}`, color: "var(--dash-muted)", background: "var(--dash-border)" }
    : { label: st.label, color: st.color, background: st.bg }

  const isUploadTargetForFocused = focusedStage ? focusedStage === uploadStage : false

  return (
    <div className="dash">
      <DashTopHeader
        email={email}
        title="Кабинет специалиста"
        logoHref={SPECIALIST_CABINET_LOGO_HREF}
        navItems={buildSpecialistCabinetNavItems("orders")}
        orderChat={{ orderId: order.id, viewerRole: "SPECIALIST" }}
        statusChip={headerChip}
        primaryAction={headerPrimary}
      />
      <DashMainLayout sidebar={<DashSidebarNav tabs={SPECIALIST_ROUTE_TABS} activeTab="orders" />}>

        {!focusedStageType ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <DashPageTitle subtitle={new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}>
                Заказ #{shortId}
              </DashPageTitle>
            </div>

            <div className="dash-content">
              <div className="dash-col1">

                <DashSurfaceCard padding="md" className="dash-surface-card--mb" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, hsl(200,60%,58%), hsl(230,60%,48%))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.95rem", color: "#fff", flexShrink: 0 }}>
                    {(order.client.name ?? order.client.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.78rem", color: "var(--dash-muted)", margin: "0 0 1px" }}>Заказчик</p>
                    <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--dash-text)", margin: 0 }}>{order.client.name ?? order.client.email}</p>
                  </div>
                </DashSurfaceCard>

                {briefHelpRequested && (
                  <DashSurfaceCard padding="md" className="dash-surface-card--mb" style={{ borderColor: "var(--dash-warn)", background: "var(--dash-warn-bg)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: "0.82rem", lineHeight: 1.45, color: "var(--dash-text2)" }}>
                      <i className="bx bx-support" style={{ color: "var(--dash-warn)", fontSize: "1.15rem", flexShrink: 0, marginTop: 2 }} aria-hidden />
                      <span style={{ overflowWrap: "anywhere" }}>
                        Заказчик запросил помощь менеджера по брифу — учтите это при изучении материалов и уточняющих вопросах.
                      </span>
                    </div>
                  </DashSurfaceCard>
                )}

                <DashSurfaceCard padding="md" className="dash-surface-card--mb">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--dash-text2)" }}>Документы к брифу</span>
                    <button
                      type="button"
                      className="dash-header__btn dash-header__btn--accent"
                      style={{ padding: "0.45em 0.8em", fontSize: "0.78rem" }}
                      onClick={() => void loadBriefFiles()}
                    >
                      <i className="bx bx-paperclip" aria-hidden />
                      {briefFilesLoaded ? "Обновить" : "Показать"}
                    </button>
                  </div>
                  {briefFilesLoaded && briefFiles.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {briefFiles.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/files/download?key=${encodeURIComponent(f.s3Key)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--dash-border)",
                            background: "var(--dash-surface2)",
                            color: "var(--dash-text)",
                            textDecoration: "none",
                            fontSize: "0.82rem",
                          }}
                          title="Скачать"
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                          <i className="bx bx-download" style={{ color: "var(--dash-muted)" }} aria-hidden />
                        </a>
                      ))}
                    </div>
                  ) : briefFilesLoaded ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--dash-muted)" }}>Нет прикрепленных файлов.</div>
                  ) : (
                    <div style={{ fontSize: "0.78rem", color: "var(--dash-muted)" }}>Нажмите «Показать», чтобы загрузить список.</div>
                  )}
                </DashSurfaceCard>

                <ClientContractPanel
                  contract={order.contract as never}
                  orderId={order.id}
                  userRole="SPECIALIST"
                  onUploadSigned={async (file) => {
                    const fd = new FormData()
                    fd.append("file", file)
                    const res = await fetch(`/api/orders/${order.id}/contract/specialist/sign`, { method: "POST", body: fd })
                    if (res.ok) {
                      const { contract } = await res.json()
                      setOrder(prev => ({ ...prev, contract }))
                      return { success: true }
                    }
                    const err = await res.json().catch(() => ({}))
                    return { success: false, error: err.error || "Ошибка загрузки" }
                  }}
                />

                {order.payments.length > 0 && (
                  <DashSurfaceCard padding="md">
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--dash-text2)", display: "block", marginBottom: 8 }}>Оплата</span>
                    {order.payments.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--dash-text)" }}>{(p.amount / 100).toLocaleString("ru-RU")} руб.</span>
                        <span style={{ color: p.status === "RELEASED" ? "var(--dash-success)" : p.status === "PENDING" ? "var(--dash-warn)" : "var(--dash-muted)", fontWeight: 500 }}>
                          {p.status === "PENDING" ? "Ожидает" : p.status === "HELD" ? "Удержана" : p.status === "RELEASED" ? "Выплачена" : p.status}
                        </span>
                      </div>
                    ))}
                  </DashSurfaceCard>
                )}

                {order.briefData && Object.values(order.briefData).some(Boolean) && (
                  <div id="order-brief" className="dash-surface-card--mb" style={{ scrollMarginTop: 88, marginTop: 16 }}>
                    <DashBriefCard title="Бриф проекта" labels={SPECIALIST_ORDER_BRIEF_LABELS} values={order.briefData} showOnlyFilled />
                  </div>
                )}
              </div>

              <div className="dash-col2">
                <div className="dash-order-top">
                  <DashInfoChip dot="A" label="Заказчик" value={order.client.name ?? order.client.email} />
                  <DashProgressCard current={approved} total={total} />
                </div>

                {/* Ход работ */}
                <div style={{ marginBottom: 16 }}>
                  <OrderStagesGrid
                    orderId={order.id}
                    stages={gridStages}
                    showActivityFooter={false}
                    resolveStageHref={({ orderId, stageType }) => `/work/${orderId}/${stageType}`}
                    viewerRole="SPECIALIST"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="dash-content">
            <div className="dash-col1">
              <div className="dash-list-heading-wrap dash-brief-head">
                <h2 className="dash-list-heading">Этап</h2>
              </div>

              <div className="dash-surface-card dash-brief-card" style={{ overflow: "hidden" }}>
                <div className="dash-brief-row" style={{ borderBottom: "1px solid var(--dash-border)" }}>
                  <div className="dash-brief-label">Проект</div>
                  <span className="dash-brief-value">#{order.id.slice(-6).toUpperCase()}</span>
                </div>

                <div className="dash-brief-row" style={{ borderBottom: "1px solid var(--dash-border)" }}>
                  <div className="dash-brief-label">Название</div>
                  <span className="dash-brief-value">{focusedStage ? stageTitle : "—"}</span>
                </div>

                {focusedStage ? (
                  <div className="dash-brief-row" style={{ borderBottom: "1px solid var(--dash-border)" }}>
                    <div className="dash-brief-label">Статус</div>
                    <span className="dash-brief-value" style={{ color: STAGE_STATUS_SHARED[focusedStage.status as StageStatus]?.color }}>
                      {stageStatusLabel}
                    </span>
                  </div>
                ) : null}

                <div className="dash-brief-row" style={{ borderBottom: "none" }}>
                  <div className="dash-brief-label">О этапе</div>
                  <div className="dash-brief-value" style={{ whiteSpace: "normal" }}>
                    {stageAbout}
                  </div>
                </div>
              </div>

              {focusedStage ? (
                <div className="dash-surface-card" style={{ marginTop: 12, padding: 12 }}>
                  {focusedStage.rulesS3Key ? (
                    <>
                      <a
                        href={`/api/stages/${focusedStage.id}/rules`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          textDecoration: "none",
                          color: "var(--dash-text)",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                        }}
                      >
                        <i className="bx bx-book-open" style={{ color: "var(--dash-accent)", fontSize: "1.05rem" }} aria-hidden />
                        Правила этапа (скачать)
                      </a>
                      <div style={{ marginTop: 6, fontSize: "0.74rem", color: "var(--dash-muted)", lineHeight: 1.45 }}>
                        Документ прикреплён администратором. Откроется в новой вкладке.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--dash-text)", fontSize: "0.85rem", fontWeight: 700 }}>
                        <i className="bx bx-book-open" style={{ color: "var(--dash-muted)", fontSize: "1.05rem" }} aria-hidden />
                        Правила этапа
                      </div>
                      <div style={{ marginTop: 6, fontSize: "0.74rem", color: "var(--dash-muted)", lineHeight: 1.45 }}>
                        Пока не прикреплены администратором.
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <div style={{ marginTop: 16 }}>
                <Link href={`/work/${order.id}`} prefetch={false} className="dash-header__btn dash-header__btn--primary" style={{ width: "100%", justifyContent: "center", boxSizing: "border-box" }}>
                  <i className="bx bx-left-arrow-alt" aria-hidden />
                  К заказу и брифу
                </Link>
              </div>
            </div>

            <div className="dash-col2 order-work-stage-col2">
              <div className="order-work-stage-main">
                <div className="dash-list-heading-wrap" style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/work/${order.id}`} prefetch={false} className="dash-header__btn dash-header__btn--primary">
                    <i className="bx bx-left-arrow-alt" aria-hidden />
                    К заказу
                  </Link>
                </div>

                {focusedStage ? (
                  <div id={`stage-${focusedStage.id}`} style={{ scrollMarginTop: 88 }}>
                    <div className="order-work-stage-card-single">
                      <div
                        className="dash-stage-card"
                        style={{
                          borderColor: isUploadTargetForFocused && canUploadToStage ? "var(--dash-accent)" : "var(--dash-border)",
                        }}
                      >
                        <div className="dash-stage-card__head">
                          <span className="dash-stage-card__title">{focusedStage.label}</span>
                          {focusedStage.status === "APPROVED" ? (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "var(--dash-success)",
                                padding: "5px 12px",
                                borderRadius: 999,
                                border: "1px solid var(--dash-success)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(46,184,92,0.08)",
                              }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--dash-success)", flexShrink: 0 }} aria-hidden />
                              {specialistStageStatusLabel(focusedStage.type, focusedStage.status)}
                            </span>
                          ) : (
                            <span className="dash-stage-card__status" style={{ color: STAGE_STATUS_SHARED[focusedStage.status as StageStatus]?.color ?? "var(--dash-muted)" }}>
                              {specialistStageStatusLabel(focusedStage.type, focusedStage.status)}
                            </span>
                          )}
                        </div>
                        <SpecialistStageWorkBody
                          stage={focusedStage}
                          isUploadTarget={isUploadTargetForFocused}
                          canUploadToStage={canUploadToStage}
                          onPreviewMedia={({ stageId, fileId, filename, url }) => {
                            setPreviewUrl(url)
                            setPreviewFilename(filename)
                            setPreviewFileId(fileId)
                            setPreviewStageId(stageId)
                          }}
                          onSubmitStage={handleSubmitStage}
                          onUploadAct={handleUploadAct}
                        />
                      </div>
                    </div>

                  </div>
                ) : (
                  <div
                    style={{
                      background: "var(--dash-surface)",
                      border: "1px solid var(--dash-border)",
                      borderRadius: 12,
                      padding: 16,
                      color: "var(--dash-muted)",
                      fontSize: "0.9rem",
                    }}
                  >
                    Этап не найден.
                  </div>
                )}
              </div>

              {focusedStage ? (
                <aside className="order-work-history-aside" aria-label="История этапа">
                  <OrderHistoryTimeline orderId={order.id} stageId={focusedStage.id} viewerRole="SPECIALIST" />
                </aside>
              ) : null}
            </div>
          </div>
        )}
      </DashMainLayout>

      {previewUrl && previewStageId && (
        <FilePreviewModal
          url={previewUrl}
          filename={previewFilename}
          stageId={previewStageId}
          fileId={previewFileId}
          editable={false}
          readonlyReason="Пометки от заказчика доступны только для просмотра."
          onClose={() => {
            setPreviewUrl(null)
            setPreviewFilename("")
            setPreviewFileId(null)
            setPreviewStageId(null)
          }}
        />
      )}
    </div>
  )
}
