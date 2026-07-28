"use client"

import { StatusBadge } from "@/components/app/AppCard"
import type { Order, Stage } from "../types"
import { ACT_STATUS_LABEL, PAYMENT_STATUS_LABEL, STAGE_LABEL, STAGE_STATUS_LABEL } from "../types"
import { formatReviewLabel } from "./formatReviewLabel"

function formatStageDt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StageSummaryCards({
  order,
  stage,
}: {
  order: Order
  stage: Stage
}) {
  const reviewsChrono = [...(stage.reviews ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const modReleases = (stage.reviews ?? []).filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "APPROVED")
  const lastModRelease = modReleases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const clientAccepts = (stage.reviews ?? []).filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "APPROVED")
  const lastClientAccept = clientAccepts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const fileShared = stage.files.filter((f) => (f.audience ?? "SHARED") === "SHARED").length
  const fileDesigner = stage.files.filter((f) => f.audience === "DESIGNER").length
  const fileClient = stage.files.filter((f) => f.audience === "CLIENT").length
  const pendingExtra = stage.extraPayments?.filter((p) => p.status === "PENDING" || p.status === "HELD") ?? []

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--adm-sidebar-border)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: "0.65rem", color: "var(--adm-muted)", textTransform: "uppercase", marginBottom: 8 }}>
          Сводка по этапу
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "8px 16px",
            fontSize: "0.78rem",
            color: "var(--adm-text)",
          }}
        >
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Этап · </span>
            {STAGE_LABEL[stage.type]}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Статус процесса · </span>
            {STAGE_STATUS_LABEL[stage.status]}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Цена этапа · </span>
            {stage.price != null ? `${(stage.price / 100).toLocaleString("ru-RU")} ₽` : "не задана"}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Платёж по этапу · </span>
            {stage.payment
              ? `${((stage.payment.amount ?? 0) / 100).toLocaleString("ru-RU")} ₽ — ${PAYMENT_STATUS_LABEL[stage.payment.status] ?? stage.payment.status}`
              : "нет записи"}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Файлы · </span>
            {stage.files.length === 0
              ? "нет"
              : `${stage.files.length} всего (общие ${fileShared}, дизайнер ${fileDesigner}, заказчик ${fileClient})`}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>PDF-инструкция · </span>
            {stage.rulesS3Key ? "загружена" : "не загружена"}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Выпуск к заказчику · </span>
            {lastModRelease ? formatStageDt(lastModRelease.createdAt) : "ещё не было"}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Принято заказчиком · </span>
            {lastClientAccept ? formatStageDt(lastClientAccept.createdAt) : "нет"}
          </div>
          <div>
            <span style={{ color: "var(--adm-muted)" }}>Акт · </span>
            {stage.act && stage.act.status !== "PENDING"
              ? ACT_STATUS_LABEL[stage.act.status] ?? stage.act.status
              : order.status === "DRAFT"
                ? "—"
                : "ожидает загрузку"}
            {stage.act?.adminConfirmedAt ? ` · подтв. ${formatStageDt(stage.act.adminConfirmedAt)}` : null}
          </div>

          {pendingExtra.length > 0 ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--adm-muted)" }}>Открытые доплаты · </span>
              {pendingExtra.map((p) => (
                <span key={p.id} className="sp-tag" style={{ marginRight: 6, marginTop: 4, display: "inline-block" }}>
                  {(p.amount / 100).toLocaleString("ru-RU")} ₽ — {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                  {p.reason ? ` (${p.reason})` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
        <StatusBadge
          variant={
            stage.status === "APPROVED"
              ? "done"
              : stage.status === "MOD_REVIEW"
                ? "current"
                : stage.status.includes("REVISION")
                  ? "rejected"
                  : "pending"
          }
          label={STAGE_STATUS_LABEL[stage.status]}
        />
      </div>

      {reviewsChrono.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--adm-sidebar-border)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "var(--adm-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            История решений ({reviewsChrono.length})
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {reviewsChrono.map((r) => (
              <div key={r.id} style={{ fontSize: "0.78rem", color: "var(--adm-text)" }}>
                <span style={{ fontWeight: 600 }}>{formatReviewLabel(r)}</span>
                <span style={{ color: "var(--adm-muted)" }}> · {formatStageDt(r.createdAt)}</span>
                {r.comment ? (
                  <div style={{ color: "var(--adm-muted)", marginTop: 2, lineHeight: 1.35 }}>{r.comment}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

