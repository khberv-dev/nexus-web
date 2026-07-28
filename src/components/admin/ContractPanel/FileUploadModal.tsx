"use client"

import { useState, useRef, type ChangeEvent } from "react"
import type { FileUploadModalProps } from "./types"

export function FileUploadModal({
  open,
  onClose,
  onUpload,
  title,
  description,
  accept = ".pdf",
}: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    const result = await onUpload(file)
    setLoading(false)
    if (result.success) {
      onClose()
      setFile(null)
    } else {
      setError(result.error || "Ошибка загрузки")
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
        setError("Загрузите файл в формате PDF")
        return
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("Размер файла не должен превышать 10МБ")
        return
      }
      setFile(f)
      setError(null)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: "90vw",
          color: "#fff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            ×
          </button>
        </div>
        <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: 16 }}>{description}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: 12,
            border: "2px dashed #444",
            borderRadius: 8,
            background: "#222",
            color: "#999",
            cursor: "pointer",
            fontSize: "0.9rem",
            marginBottom: 12,
            minHeight: 48,
          }}
        >
          <i className="bx bx-upload" />
          {file ? file.name : "Выберите файл (PDF, до 10МБ)"}
        </button>
        {error && <p style={{ color: "#f44336", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "#222",
              color: "#999",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#34d399",
              color: "#fff",
              cursor: !file || loading ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {loading ? "Загрузка…" : "Загрузить"}
          </button>
        </div>
      </div>
    </div>
  )
}
