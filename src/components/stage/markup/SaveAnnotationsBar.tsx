import React, { useState, type MutableRefObject } from "react"
import { useAnnotator } from "@annotorious/react"
import type { AnnotoriousImageAnnotator } from "@annotorious/react"
import { markupHintColor } from "./constants"
import type { MarkupToastVariant } from "./types"

export function SaveAnnotationsBar({
  editable,
  stageId,
  fileId,
  showToast,
  lastSavedJsonRef,
}: {
  editable: boolean
  stageId: string
  fileId: string
  showToast: (message: string, variant: MarkupToastVariant) => void
  lastSavedJsonRef: MutableRefObject<string | null>
}) {
  const anno = useAnnotator<AnnotoriousImageAnnotator>()
  const [saving, setSaving] = useState(false)

  if (!editable) return null

  const onSave = async () => {
    if (!anno) return
    setSaving(true)
    try {
      const annotations = anno.getAnnotations()
      const r = await fetch(`/api/stages/${stageId}/files/${fileId}/annotations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations, notifyDesigner: true }),
      })
      if (r.ok) {
        try {
          lastSavedJsonRef.current = JSON.stringify(annotations)
        } catch {
          lastSavedJsonRef.current = null
        }
        showToast("Пометки сохранены и отправлены дизайнеру", "success")
      } else showToast("Не удалось сохранить пометки. Попробуйте еще раз.", "error")
    } catch {
      showToast("Не удалось сохранить пометки. Проверьте сеть.", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        style={{
          padding: "0.5em 1rem",
          borderRadius: 8,
          border: "none",
          background: "var(--dash-accent, #2563eb)",
          color: "#fff",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          fontFamily: "inherit",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Сохранение…" : "Сохранить пометки"}
      </button>
      <span style={{ fontSize: "0.72rem", color: markupHintColor }}>
        Пометки подтягиваются с сервера после обновления страницы; черновик дополнительно сохраняется автоматически.
        Кнопка — явное сохранение и сигнал дизайнеру.
      </span>
    </div>
  )
}

