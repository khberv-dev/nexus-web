import type {CSSProperties} from "react"
import {GLASS_CARD, ROLE_H} from "./constants"

export const inputStyle: CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    color: "#f4f4f4",
    fontSize: "0.9rem",
    padding: "0.75em 1em",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
}

export function loginShellStyle(mobile: boolean): CSSProperties {
    return {
        fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
        ...(mobile ? {...GLASS_CARD, padding: "1.35rem 1.1rem"} : {}),
    }
}

/** Как карточки выбора роли: та же высота, отступы, скругление и начертание заголовка */
export function sideBtnStyle(
    mobile: boolean,
    variant: "primary" | "default" | "dim" = "default"
): CSSProperties {
    const minH = mobile ? 76 : ROLE_H
    const palette = {
        primary: {bg: "rgba(255,255,255,0.14)", border: "rgba(255,255,255,0.28)"},
        dim: {bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)"},
        default: {bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.14)"},
    }[variant]
    const {bg, border} = palette
    return {
        width: "100%",
        minHeight: minH,
        padding: mobile ? "0.9rem 1.1rem" : "0 1.25em",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        boxSizing: "border-box",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        color: "#f4f4f4",
        cursor: "pointer",
        fontSize: mobile ? "1.05rem" : "1rem",
        fontWeight: variant === "primary" ? 600 : 500,
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        marginBottom: 8,
        transition: "background 0.2s, border-color 0.2s",
    }
}

export function primaryAuthButton(loading: boolean): CSSProperties {
    return {
        width: "100%",
        minHeight: 48,
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 12,
        color: "#f4f4f4",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.55 : 1,
    }
}

export function chipStyle(active: boolean): CSSProperties {
    return {
        padding: "0.35em 0.75em",
        borderRadius: 100,
        fontSize: "0.74rem",
        fontFamily: "inherit",
        cursor: "pointer",
        border: `1px solid ${active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"}`,
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#f4f4f4" : "rgba(255,255,255,0.5)",
    }
}
