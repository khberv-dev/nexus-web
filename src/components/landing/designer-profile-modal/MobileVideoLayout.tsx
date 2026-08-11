"use client"

import type {RefObject} from "react"
import {CLOSE_BTN_STYLE} from "./styles"
import {IntroVideoPlayer} from "./IntroVideoPlayer"
import {ProfileSheet} from "./ProfileSheet"
import type {useProfileSheet} from "./hooks/useProfileSheet"

type SheetState = ReturnType<typeof useProfileSheet>

interface MobileVideoLayoutProps {
    videoRef: RefObject<HTMLVideoElement | null>
    videoSrc: string
    muted: boolean
    onToggleMute: () => void
    onClose: () => void
    sheet: SheetState
    children: React.ReactNode
}

export function MobileVideoLayout({
                                      videoRef,
                                      videoSrc,
                                      muted,
                                      onToggleMute,
                                      onClose,
                                      sheet,
                                      children,
                                  }: MobileVideoLayoutProps) {
    return (
        <div style={{position: "relative", width: "100%", height: "100%", background: "#000"}}>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <IntroVideoPlayer
                    videoRef={videoRef}
                    src={videoSrc}
                    muted={muted}
                    onToggleMute={onToggleMute}
                    objectFit="contain"
                />
            </div>

            <button type="button" onClick={onClose} style={{...CLOSE_BTN_STYLE, zIndex: 20}}>✕</button>

            <ProfileSheet
                sheetRef={sheet.sheetRef}
                sheetOffset={sheet.sheetOffset}
                sheetDragActive={sheet.sheetDragActive}
                sheetHandlers={sheet.sheetHandlers}
            >
                {children}
            </ProfileSheet>
        </div>
    )
}
