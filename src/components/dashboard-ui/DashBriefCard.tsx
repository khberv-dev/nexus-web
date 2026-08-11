import type {ReactNode} from "react"
import {DashSurfaceCard} from "./DashSurfaceCard"

function isHttpUrl(s: string): boolean {
    return /^https?:\/\/\S+$/i.test(s)
}

function isImageLikeUrl(s: string): boolean {
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(s)
}

function isLikelyS3ImageKey(s: string): boolean {
    if (/\s/.test(s)) return false
    if (!s.includes("/")) return false
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(s)
}

function toLinkCandidate(token: string): string | null {
    const t = token.trim()
    if (!t) return null
    if (isHttpUrl(t)) return t
    if (isLikelyS3ImageKey(t)) return `/api/files/download?key=${encodeURIComponent(t)}`
    return null
}

/** briefData — Prisma Json; старые брифы хранят rooms как массив, budget как число и т.п. */
function toDisplayString(raw: unknown): string {
    if (raw == null) return ""
    if (typeof raw === "string") return raw
    if (Array.isArray(raw)) return raw.map(toDisplayString).filter(Boolean).join(", ")
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
    return String(raw)
}

function renderReadonlyValue(rawValue: unknown): ReactNode {
    const value = toDisplayString(rawValue)
    if (!value.trim()) return "—"
    const tokens = value.split(/[\s,;\n]+/).filter(Boolean)
    const links = tokens.map(toLinkCandidate).filter((v): v is string => Boolean(v))
    if (links.length === 0) return value

    const imageLinks = links.filter(isImageLikeUrl)
    const fileLinks = links.filter(link => !isImageLikeUrl(link))
    const plainText = value
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim()

    return (
        <span style={{display: "grid", gap: 8}}>
      {plainText ? <span>{plainText}</span> : null}
            {imageLinks.length > 0 ? (
                <span style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          {imageLinks.map(link => (
              <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                      display: "inline-flex",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid var(--dash-border)"
                  }}
                  title="Открыть изображение"
              >
                  <img src={link} alt="brief reference"
                       style={{width: 88, height: 64, objectFit: "cover", display: "block"}}/>
              </a>
          ))}
        </span>
            ) : null}
            {fileLinks.length > 0 ? (
                <span style={{display: "grid", gap: 4}}>
          {fileLinks.map(link => (
              <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  style={{color: "var(--dash-accent)", textDecoration: "underline", textUnderlineOffset: 2}}
              >
                  {link}
              </a>
          ))}
        </span>
            ) : null}
    </span>
    )
}

export function DashBriefCard({
                                  title = "Бриф проекта",
                                  labels,
                                  values,
                                  editable = false,
                                  showOnlyFilled = false,
                                  onChange,
                                  headingRight,
                                  placeholders = {},
                              }: {
    title?: string
    labels: Record<string, string>
    // Backed by Order.briefData (Prisma Json) — legacy briefs can hold arrays/numbers, not just strings.
    values: Record<string, unknown>
    editable?: boolean
    showOnlyFilled?: boolean
    onChange?: (key: string, value: string) => void
    headingRight?: ReactNode
    placeholders?: Record<string, string>
}) {
    const entries = Object.entries(labels).filter(([key]) => !(showOnlyFilled && !values[key]))

    return (
        <>
            <div className="dash-list-heading-wrap dash-brief-head">
                <h2 className="dash-list-heading">{title}</h2>
                {headingRight}
            </div>

            {/* Shared UI component: brief card */}
            <DashSurfaceCard className="dash-brief-card" style={{overflow: "hidden"}}>
                {entries.map(([key, label], i) => {
                    const value = toDisplayString(values[key])
                    return (
                        <div
                            key={key}
                            className="dash-brief-row"
                            style={{borderBottom: i < entries.length - 1 ? "1px solid var(--dash-border)" : "none"}}
                        >
                            <div className="dash-brief-label">{label}</div>
                            {editable ? (
                                <input
                                    value={value}
                                    onChange={e => onChange?.(key, e.target.value)}
                                    placeholder={placeholders[key] ?? "—"}
                                    className="dash-brief-input"
                                />
                            ) : (
                                <span className="dash-brief-value">{renderReadonlyValue(value)}</span>
                            )}
                        </div>
                    )
                })}
            </DashSurfaceCard>
        </>
    )
}
