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
            {/* Full-screen slider — на главной только реальные дизайнеры платформы */}
            <div ref={imgRef} className="absolute inset-0" style={{opacity: 0}}>
                {slides.length > 0 ? (
                    <DesignerSlider slides={slides} onBrightnessChange={onBrightnessChange}/>
                ) : (
                    <EmptyRoster/>
                )}
            </div>

            {/* Top spacer for nav */}
            <div style={{height: "5em", zIndex: 1, pointerEvents: "none"}}/>
        </div>
    )
}

/**
 * Пока ни один дизайнер не прошёл отбор и не собрал портфолио для главной —
 * показываем честную заглушку вместо выдуманных персонажей.
 */
function EmptyRoster() {
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "0 1.5em",
                color: "#f4f4f4",
            }}
        >
            <p style={{fontSize: "clamp(1.4rem, 4vw, 2.6rem)", fontWeight: 600, margin: 0, lineHeight: 1.2}}>
                Идёт отбор дизайнеров
            </p>
            <p
                style={{
                    marginTop: "0.8em",
                    maxWidth: "34rem",
                    fontSize: "clamp(0.9rem, 1.6vw, 1.05rem)",
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.6)",
                }}
            >
                Здесь появятся дизайнеры NEXUS, прошедшие квалификацию, — с подтверждённым уровнем и портфолио
                реализованных проектов.
            </p>
        </div>
    )
}
