import { FILE_CATEGORY_LABEL } from "../constants"
import { openAdminFileDownload } from "../utils"
import type { RawSpecialist } from "../../../types"

export function FilesCard({ files }: { files: RawSpecialist["files"] }) {
  if (files.length === 0) return null

  return (
    <div className="sp-card">
      <div className="sp-card-hd"><span className="sp-label">Файлы</span><span className="sp-badge">{files.length}</span></div>
      <div className="sp-card-bd" style={{ padding: "4px 0" }}>
        {files.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 4px",
              borderBottom: "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.06))",
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: "0.72rem", color: "var(--adm-active-color)", fontWeight: 600 }}>
                {FILE_CATEGORY_LABEL[f.category] ?? f.category}
              </span>
              <div style={{ fontSize: "0.8rem", marginTop: 2 }}>
                <i className="bx bx-file" style={{ marginRight: 6, color: "var(--adm-muted)" }} />
                {f.filename ?? "Файл"}
              </div>
            </div>
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              style={{ flexShrink: 0, fontSize: "0.72rem" }}
              onClick={() => void openAdminFileDownload(f.id)}
            >
              <i className="bx bx-download" /> Скачать
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
