"use client"

import type { Designer } from "./types"

interface ProfileHeaderProps {
  designer: Designer
  compact?: boolean
}

export function ProfileHeader({ designer: d, compact }: ProfileHeaderProps) {
  const avatarSize = compact ? 56 : 72
  const nameSize = compact ? "1.05rem" : "1.3rem"
  const specSize = compact ? "0.8rem" : "0.82rem"

  return (
    <div style={{ display: "flex", alignItems: compact ? "center" : "flex-end", gap: compact ? 14 : 16, marginBottom: compact ? 20 : 0 }}>
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
      <div style={{ minWidth: 0 }}>
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
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: specSize, margin: 0 }}>{d.specialty}</p>
      </div>
    </div>
  )
}
