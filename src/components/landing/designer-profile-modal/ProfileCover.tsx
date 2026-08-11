"use client"

import {CLOSE_BTN_STYLE} from "./styles"
import {ProfileHeader} from "./ProfileHeader"
import type {Designer} from "./types"

interface ProfileCoverProps {
    designer: Designer
    onClose: () => void
}

export function ProfileCover({designer, onClose}: ProfileCoverProps) {
    return (
        <div
            style={{
                position: "relative",
                height: 200,
                flexShrink: 0,
                background: `url('${designer.work}') center ${designer.workPos ?? "center"} / cover no-repeat`,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 100%)",
                }}
            />
            <button type="button" onClick={onClose} style={{...CLOSE_BTN_STYLE, zIndex: 1}}>✕</button>
            <div style={{position: "absolute", bottom: 20, left: 24}}>
                <ProfileHeader designer={designer}/>
            </div>
        </div>
    )
}
