"use client"

import type {Designer} from "./types"

interface ProfileHeaderProps {
    designer: Designer
    compact?: boolean
}

export function ProfileHeader({designer: d, compact}: ProfileHeaderProps) {
    const avatarSize = compact ? 56 : 72
    const nameSize = compact ? "1.05rem" : "1.3rem"
    const specSize = compact ? "0.8rem" : "0.82rem"

    return (
        <div style={{
            display: "flex",
            alignItems: compact ? "center" : "flex-end",
            gap: compact ? 14 : 16,
            marginBottom: compact ? 20 : 0
        }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={d.portrait}
                alt={d.name}
                style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: "50%",
                    border: compact ? "2px solid rgba(255,255,255,0.35)" : "3px solid rgba(255,255,255,0.5)",
                    objectFit: "cover",
                    flexShrink: 0,
                }}
            />
            <div style={{minWidth: 0}}>
                <h2
                    style={{
                        color: "#fff",
                        fontSize: nameSize,
                        fontWeight: 700,
                        margin: "0 0 2px",
                        textTransform: "uppercase",
                        fontFamily: "'PP Neue Montreal', Inter, sans-serif",
                    }}
                >
                    {d.name}
                </h2>
                <p style={{color: "rgba(255,255,255,0.6)", fontSize: specSize, margin: 0}}>
                    {d.levelTitle && (
                        <span
                            style={{
                                display: "inline-block",
                                marginRight: "0.5em",
                                padding: "0.15em 0.6em",
                                borderRadius: 999,
                                border: d.level === "L4" ? "1px solid rgba(212,175,55,0.75)" : "1px solid rgba(255,255,255,0.35)",
                                background: d.level === "L4" ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.12)",
                                color: d.level === "L4" ? "#f0d98c" : "rgba(255,255,255,0.85)",
                                fontSize: "0.85em",
                                fontWeight: 600,
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {d.levelTitle}
                        </span>
                    )}
                    {d.specialty}
                </p>
            </div>
        </div>
    )
}
