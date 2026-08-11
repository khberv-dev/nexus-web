import type {CSSProperties} from "react"

export const MUTE_BTN_STYLE: CSSProperties = {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
}

/** Полупрозрачная панель — inline, чтобы не перебивалось bg-card / theme */
export const GLASS_PANEL_STYLE: CSSProperties = {
    background: "rgba(17, 18, 24, 0.38)",
    backdropFilter: "blur(24px) saturate(1.2)",
    WebkitBackdropFilter: "blur(24px) saturate(1.2)",
}

export const GLASS_PANEL_BORDER_TOP: CSSProperties = {
    borderTop: "1px solid rgba(255, 255, 255, 0.2)",
}

export const CLOSE_BTN_STYLE: CSSProperties = {
    position: "absolute",
    top: 14,
    right: 14,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: "0.9rem",
    padding: "0.3em 0.6em",
    lineHeight: 1,
    zIndex: 2,
}
