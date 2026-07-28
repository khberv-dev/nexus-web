"use client"

import { useEffect, useState } from "react"
import { BriefEditor } from "@/components/admin/BriefEditor"
import { Modal } from "@/components/ui/modal"
import { STAGE_ORDER } from "@/lib/stage-constants"
import type { Order, OrderStatus, SpecialistForAssignment } from "./types"
import { adminManualStatusTargets } from "./types"
import { OrderAlerts } from "./components/OrderAlerts"
import { OrderHeader } from "./components/OrderHeader"
import { OrderInfoCards } from "./components/OrderInfoCards"
import { OrderTabs, type OrderDetailTab } from "./components/OrderTabs"
import { OrderOverviewTab } from "./components/OrderOverviewTab"
import { OrderStagesTab } from "./components/OrderStagesTab"
import { OrderManageTab } from "./components/OrderManageTab"
import { OrderAuditSidebar } from "./components/OrderAuditSidebar"
import { FilePreviewModal } from "./components/FilePreviewModal"
import { OrderChatPanel } from "@/components/dashboard-ui/OrderChatPanel"
import { DashRightDrawer } from "@/components/dashboard-ui/DashRightDrawer"

interface Props {
  order: Order | null
  specialists: SpecialistForAssignment[]
  assignMap: Record<string, string>
  assigning: string | null
  acting: string | null
  contractGenerating: string | null
  onAssignMapChange: (orderId: string, specId: string) => void
  onAssign: (orderId: string) => void
  onReviewStage: (stageId: string, action: "modApprove" | "modRevision", stageName: string) => void
  onExtraPayment: (stageId: string, stageName: string) => void
  onClientRevision?: (stageId: string, action: "accept" | "reject", stageName: string) => void
  onChangeStatus: (orderId: string, status: OrderStatus) => void
  onBriefApprove: (orderId: string) => void
  onBriefReject: (orderId: string) => void
  onBriefSaved?: () => void
  onResolveHelp: (orderId: string) => void
  onGenerateContract: (orderId: string) => void
  onSendContractToClient: (orderId: string) => void
  onConfirmContract: (orderId: string) => void
  onApproveAct: (stageId: string, actId: string) => void
  onRejectAct: (stageId: string, actId: string, comment: string) => void
  onConfirmAct: (stageId: string, actId: string) => void
}

export function OrderDetail({
  order, specialists, assignMap, assigning, acting,
  onAssignMapChange, onAssign, onReviewStage, onExtraPayment, onChangeStatus,
  onBriefApprove, onBriefReject, onBriefSaved, onResolveHelp,
  onGenerateContract, onSendContractToClient, onConfirmContract,
  onApproveAct, onRejectAct, onConfirmAct,
  onClientRevision,
}: Props) {
  const [briefModalOpen, setBriefModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<OrderDetailTab>("overview")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFilename, setPreviewFilename] = useState("")
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [previewStageId, setPreviewStageId] = useState<string | null>(null)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)

  const dashVarsForAdmin: React.CSSProperties = {
    // Drawer panel background: match admin page outer background.
    ["--dash-surface" as never]: "var(--adm-outer, #f3f4f6)",
    // Secondary surfaces inside the drawer (header + message bubbles).
    ["--dash-surface2" as never]: "var(--adm-content-bg, #ffffff)",
    ["--dash-border" as never]: "var(--adm-sidebar-border, #e5e7eb)",
    ["--dash-text" as never]: "var(--adm-text, #111827)",
    ["--dash-text2" as never]: "var(--adm-text, #111827)",
    ["--dash-muted" as never]: "var(--adm-muted, #6b7280)",
    // Inputs/backgrounds inside the chat panel.
    ["--dash-bg" as never]: "var(--adm-content-bg, #ffffff)",
    ["--dash-accent" as never]: "var(--adm-active-color, #6366f1)",
    ["--dash-accent-bg" as never]: "var(--adm-active-bg, rgba(99,102,241,0.10))",
    ["--dash-accent-border" as never]: "var(--adm-active-color, #6366f1)",
    ["--dash-danger" as never]: "#dc2626",
  }

  // Restore active tab from URL (?tab=overview|stages|manage) so refresh doesn't reset.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const tab = url.searchParams.get("tab") as OrderDetailTab | null
    if (tab === "overview" || tab === "stages" || tab === "manage") setActiveTab(tab)
  }, [])

  // Persist active tab into URL.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("tab", activeTab)
    window.history.replaceState(null, "", url.toString())
  }, [activeTab])

  if (!order) {
    return (
      <div className="sp-detail">
        <div style={{ textAlign: "center", color: "var(--adm-muted)", padding: "60px 0" }}>
          <i className="bx bx-folder-open" style={{ fontSize: 48, opacity: 0.3, display: "block" }} />
          <p style={{ marginTop: 8 }}>Выберите заказ</p>
        </div>
      </div>
    )
  }

  const bd = order.briefData
  const title = order.title ?? bd?.name ?? `Заказ #${order.id.slice(-6)}`
  const needsAssign = !order.specialist && order.status !== "DRAFT" && order.status !== "CANCELLED"
  const modStages = order.stages.filter(s => s.status === "MOD_REVIEW")
  const statusTargets = adminManualStatusTargets(order.status)
  const stagesByType = new Map(order.stages.map((s) => [s.type, s]))
  const orderedStages = (STAGE_ORDER as readonly string[])
    .map((t) => stagesByType.get(t as never))
    .filter(Boolean) as typeof order.stages

  const preview = {
    url: previewUrl,
    filename: previewFilename,
    fileId: previewFileId,
    stageId: previewStageId,
    open: (args: { url: string; filename: string; fileId: string | null; stageId: string }) => {
      setPreviewUrl(args.url)
      setPreviewFilename(args.filename)
      setPreviewFileId(args.fileId)
      setPreviewStageId(args.stageId)
    },
    close: () => {
      setPreviewUrl(null)
      setPreviewFilename("")
      setPreviewFileId(null)
      setPreviewStageId(null)
    },
  }

  const overviewTabProps = {
    order,
    acting,
    onOpenBriefEditor: () => setBriefModalOpen(true),
    onBriefApprove,
    onBriefReject,
    onBriefSaved,
    onGenerateContract,
    onSendContractToClient,
    onConfirmContract,
  } as const

  const stagesTabProps = {
    order,
    orderedStages,
    acting,
    onReviewStage,
    onExtraPayment,
    onClientRevision,
    onBriefSaved,
    onOpenPreview: preview.open,
    onApproveAct,
    onRejectAct,
    onConfirmAct,
  } as const

  const manageTabProps = {
    order,
    specialists,
    assignMap,
    assigning,
    needsAssign,
    statusTargets,
    onAssignMapChange,
    onAssign,
    onChangeStatus,
  } as const

  return (
    <div className="sp-detail">
      <div>
        <OrderAlerts
          needsAssign={needsAssign}
          modStagesCount={modStages.length}
          briefHelpRequested={order.briefHelpRequested}
          briefStep={order.briefStep}
        />

        <OrderHeader
          order={order}
          title={title}
          acting={acting}
          onResolveHelp={onResolveHelp}
          onOpenChat={() => setChatDrawerOpen(true)}
        />

        {/* Two-column: content + timeline */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Info cards */}
            <OrderInfoCards order={order} />

            {/* Tabs */}
            <OrderTabs activeTab={activeTab} modStagesCount={modStages.length} onTabChange={setActiveTab} />

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <OrderOverviewTab {...overviewTabProps} />
            )}

            {/* Stages */}
            {activeTab === "stages" && orderedStages.length > 0 && (
              <OrderStagesTab {...stagesTabProps} />
            )}

            {/* Assign specialist */}
            {activeTab === "manage" && (
              <OrderManageTab {...manageTabProps} />
            )}

          </div>

          {/* Right sidebar: timeline */}
          <OrderAuditSidebar orderId={order.id} />
        </div>

      </div>

      <DashRightDrawer
        open={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        title={"Чат"}
        titleIcon={<i className="bx bx-message-dots" aria-hidden />}
        panelWidth="min(460px, min(100vw - 24px, 520px))"
        zIndex={12050}
        ariaLabelledBy="order-admin-chat-drawer-title"
        panelId="order-admin-chat-drawer"
        scrollableBody={false}
        themeVars={dashVarsForAdmin}
      >
        {order ? (
          <>
            <OrderChatPanel
              orderId={order.id}
              viewerRole="ADMIN"
              channel="ALL"
              inDrawer
              composerMinRows={1}
              composerMaxRows={4}
            />
          </>
        ) : null}
      </DashRightDrawer>

      {preview.url && preview.stageId && (
        <FilePreviewModal
          url={preview.url}
          filename={preview.filename}
          stageId={preview.stageId}
          fileId={preview.fileId}
          editable={false}
          readonlyReason="Только просмотр в админ-панели."
          onClose={preview.close}
        />
      )}

      <Modal open={briefModalOpen} onClose={() => setBriefModalOpen(false)} maxWidth={900} theme="dark">
        <BriefEditor
          order={{
            id: order.id,
            briefData: order.briefData,
            briefHelpRequested: order.briefHelpRequested,
          }}
          onClose={() => setBriefModalOpen(false)}
          onSaved={() => {
            onBriefSaved?.()
            setBriefModalOpen(false)
          }}
        />
      </Modal>
    </div>
  )
}
