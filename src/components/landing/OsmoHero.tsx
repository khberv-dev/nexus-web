"use client"

import {useEffect, useRef} from "react"
import {gsap} from "gsap"
import {DesignerSlider} from "@/components/landing/DesignerSlider"
import type {DesignerSlide} from "@/components/landing/designer-profile-modal/types"

interface OsmoHeroProps {
    visible: boolean
    slides: DesignerSlide[]
    onBrightnessChange: (lightBg: boolean) => void
}

export function OsmoHero({visible, slides, onBrightnessChange}: OsmoHeroProps) {
    const imgRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!visible) return
        gsap.fromTo(
            imgRef.current,
            {scale: 1.08, opacity: 0},
            {scale: 1, opacity: 1, duration: 1.2, ease: "power3.out"}
        )
    }, [visible])

    if (!visible) return null

    return (
        <div
            className="fixed inset-0 overflow-hidden"
            style={{
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
                minHeight: "100dvh",
            }}
        >
            {/* Full-screen slider */}
            <div ref={imgRef} className="absolute inset-0" style={{opacity: 0}}>
                <DesignerSlider slides={slides} onBrightnessChange={onBrightnessChange}/>
            </div>

            {/* Top spacer for nav */}
            <div style={{height: "5em", zIndex: 1, pointerEvents: "none"}}/>
        </div>
    )
}
