"use client"

import { useState } from "react"
import type { OrderStage } from "@/app/orders/[id]/types"
import { ACT_STATUS_LABEL, STAGE_LABEL } from "@/app/orders/[id]/types"

interface Props {
  stage: OrderStage
  onUploadSigned: (stageId: string, file: File) => Promise<{ success: boolean; error?: string }>
}

// Форматирует дату в читаемый вид
function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function ClientActSection({ stage, onUploadSigned }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!stage.act) return null

  const act = stage.act
  const statusLabel = ACT_STATUS_LABEL[act.status] || act.status

  const canUpload = act.status === "ADMIN_APPROVED"

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
    const result = await onUploadSigned(stage.id, file)
    setUploading(false)

    if (!result.success) {
      setError(result.error || "Ошибка загрузки")
    }

    // Clear file input
    e.target.value = ""
  }

  // Цвет фона в зависимости от статуса
  const getBgColor = () => {
    switch (act.status) {
      case "REJECTED": return "rgba(234,84,85,0.06)"
      case "CONFIRMED": return "rgba(46,184,92,0.06)"
      default: return "var(--dash-surface)"
    }
  }

  // Цвет границы в зависимости от статуса
  const getBorderColor = () => {
    switch (act.status) {
      case "REJECTED": return "rgba(234,84,85,0.2)"
      case "CONFIRMED": return "rgba(46,184,92,0.2)"
      default: return "var(--dash-border)"
    }
  }

  return (
    <div
      className="dash-surface-card--mb"
      style={{
        borderRadius: 10,
        padding: "14px 16px",
        border: "1px solid var(--dash-border)",
        background: getBgColor(),
        borderColor: getBorderColor(),
        marginTop: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <i className="bx bx-file-blank" style={{ fontSize: "1.1rem", color: "var(--dash-muted)" }} />
        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--dash-text)" }}>
          Акт · {STAGE_LABEL[stage.type]}
        </span>
        <span style={{ fontSize: "0.75rem", color: act.status === "REJECTED" ? "var(--dash-danger)" : act.status === "CONFIRMED" ? "var(--dash-success)" : "var(--dash-warn)", fontWeight: 500 }}>
          {statusLabel}
        </span>
      </div>

      {canUpload && (
        <p style={{ fontSize: "0.8rem", color: "var(--dash-text2)", margin: "0 0 10px", lineHeight: 1.45 }}>
          Администратор проверил акт — скачайте PDF, подпишите и загрузите скан ниже.
        </p>
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
            {uploading ? "Загрузка..." : "Загрузить подписанный акт (PDF)"}
          </label>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(234,84,85,0.1)", fontSize: "0.78rem", color: "var(--dash-danger)" }}>
          <i className="bx bx-error-circle" style={{ marginRight: 4 }} />
          {error}
        </div>
      )}

      {/* Стандартные поля акта */}
      <div style={{ fontSize: "0.78rem", color: "var(--dash-muted)", marginTop: 8 }}>
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
