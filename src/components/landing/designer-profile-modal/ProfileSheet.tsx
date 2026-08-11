"use client"

import type {ReactNode, RefObject} from "react"
import {GLASS_PANEL_BORDER_TOP, GLASS_PANEL_STYLE} from "./styles"
import {SheetHandle} from "./SheetHandle"
import type {useProfileSheet} from "./hooks/useProfileSheet"

type SheetState = ReturnType<typeof useProfileSheet>

interface ProfileSheetProps {
    sheetRef: RefObject<HTMLDivElement | null>
    sheetOffset: number
    sheetDragActive: boolean
    sheetHandlers: SheetState["sheetHandlers"]
    children: ReactNode
}

export function ProfileSheet({
                                 sheetRef,
                                 sheetOffset,
                                 sheetDragActive,
                                 sheetHandlers,
                                 children,
                             }: ProfileSheetProps) {
    return (
        <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 z-10 flex max-h-[58%] flex-col"
            style={{
                transform: `translateY(${sheetOffset}px)`,
                transition: sheetDragActive ? "none" : "transform 0.22s cubic-bezier(0.25, 1, 0.45, 1)",
                willChange: "transform",
            }}
        >
            <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl text-white shadow-[0_-12px_48px_rgba(0,0,0,0.5)]"
                style={{...GLASS_PANEL_STYLE, ...GLASS_PANEL_BORDER_TOP}}
            >
                <SheetHandle {...sheetHandlers} />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1">
                    {children}
                </div>
            </div>
        </div>
    )
}
