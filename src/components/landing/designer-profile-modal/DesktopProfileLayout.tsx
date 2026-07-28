"use client"

import type { RefObject } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GLASS_PANEL_STYLE } from "./styles"
import { ProfileCover } from "./ProfileCover"
import { IntroVideoPlayer } from "./IntroVideoPlayer"
import type { Designer } from "./types"

interface DesktopProfileLayoutProps {
  designer: Designer
  hasVideo: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  muted: boolean
  onToggleMute: () => void
  onClose: () => void
  children: React.ReactNode
}

export function DesktopProfileLayout({
  designer,
  hasVideo,
  videoRef,
  muted,
  onToggleMute,
  onClose,
  children,
}: DesktopProfileLayoutProps) {
  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "transparent" }}>
        <ProfileCover designer={designer} onClose={onClose} />
        <ScrollArea
          tone="dark"
          className="min-h-0 flex-1 px-6 pb-7 pt-5"
          style={GLASS_PANEL_STYLE}
        >
          {children}
        </ScrollArea>
      </div>

      {hasVideo && designer.introVideoUrl && (
        <div
          style={{
            width: 360,
            flexShrink: 0,
            background: "#000",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
          }}
        >
          <IntroVideoPlayer
            videoRef={videoRef}
            src={designer.introVideoUrl}
            muted={muted}
            onToggleMute={onToggleMute}
          />
        </div>
      )}
    </>
  )
}
