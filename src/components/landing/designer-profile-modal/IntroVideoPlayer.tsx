"use client"

import type { RefObject } from "react"
import { MediaWithLoader } from "./MediaWithLoader"
import { MUTE_BTN_STYLE } from "./styles"

interface IntroVideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>
  src: string
  muted: boolean
  onToggleMute: () => void
  objectFit?: "cover" | "contain"
}

export function IntroVideoPlayer({ videoRef, src, muted, onToggleMute, objectFit = "cover" }: IntroVideoPlayerProps) {
  return (
    <>
      <MediaWithLoader className="h-full w-full">
        <video
          ref={videoRef}
          src={src}
          autoPlay
          loop
          playsInline
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit, display: "block" }}
        />
      </MediaWithLoader>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Включить звук" : "Выключить звук"}
        style={MUTE_BTN_STYLE}
      >
        <i className={`bx ${muted ? "bx-volume-mute" : "bx-volume-full"}`} />
      </button>
    </>
  )
}
