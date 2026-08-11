const AUDIENCE_MAP = {
    DESIGNER: {label: "ДИЗАЙНЕР", cls: "sp-badge sp-badge--info"},
    CLIENT: {label: "ЗАКАЗЧИК", cls: "sp-badge sp-badge--success"},
    SHARED: {label: "ОБЩИЙ", cls: "sp-badge"},
} as const

export type FileAudience = keyof typeof AUDIENCE_MAP

export function FileAudienceBadge({audience}: { audience?: FileAudience | string }) {
    const cfg = AUDIENCE_MAP[(audience ?? "SHARED") as FileAudience] ?? AUDIENCE_MAP.SHARED
    return <span className={cfg.cls} style={{fontSize: "0.62rem", letterSpacing: "0.04em"}}>{cfg.label}</span>
}
