"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {DesignerProfileModal, type DesignerSlide} from "./DesignerProfileModal"

function sampleBrightness(src: string, cb: (lightBg: boolean) => void) {
    const img = new window.Image()
    // crossOrigin только для same-origin: иначе S3 без CORS-бакета ломает загрузку (GET blocked).
    // Без crossOrigin картинка грузится; getImageData может не пройти — тогда светлый текст шапки по умолчанию.
    const fallback = () => cb(false)
    try {
        if (src.startsWith("/") || src.startsWith(window.location.origin)) {
            img.crossOrigin = "anonymous"
        }
    } catch {
        /* SSR */
    }
    img.onerror = fallback
    img.onload = () => {
        try {
            const canvas = document.createElement("canvas")
            canvas.width = 80
            canvas.height = 40
            const ctx = canvas.getContext("2d")
            if (!ctx) return fallback()
            ctx.drawImage(img, 0, 0, 80, 40)
            const {data} = ctx.getImageData(0, 0, 80, 40)
            let sum = 0
            for (let i = 0; i < data.length; i += 4) {
                sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
            }
            cb(sum / (data.length / 4) > 140)
        } catch {
            fallback()
        }
    }
    img.src = src
}

interface DesignerSliderProps {
    slides: DesignerSlide[]
    onBrightnessChange?: (lightBg: boolean) => void
}

/** Подтверждённый уровень квалификации — главный аргумент подборки на главной. */
function LevelBadge({slide}: { slide: DesignerSlide }) {
    if (!slide.levelTitle) return null
    return (
        <span className={`ds-level${slide.level === "L4" ? " ds-level--elite" : ""}`}>
            {slide.levelTitle}
        </span>
    )
}


function slideKey(s: DesignerSlide, i: number) {
    return s.id ?? `${s.name}-${s.portrait}-${i}`
}

function ActiveDesignerContent({
                                   slide,
                                   onOpenProfile,
                               }: {
    slide: DesignerSlide
    onOpenProfile: () => void
}) {
    return (
        <>
            <div className="ds-designer-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ds-avatar" src={slide.avatar ?? slide.portrait} alt={slide.name} decoding="async"/>
                <div>
                    <div className="ds-name">{slide.name}</div>
                    <div className="ds-specialty">
                        <LevelBadge slide={slide}/>
                        {slide.specialty}
                    </div>
                </div>
            </div>
            <div className="ds-meta">
                <span>{slide.experience} лет опыта</span>
                {slide.has3d && <span>3D</span>}
                {slide.hasRd && <span>Чертежи</span>}
            </div>
            <div className="ds-meta" style={{marginBottom: 4}}>
                <span>Реализовано {slide.sqm} м²</span>
            </div>
            <button type="button" className="ds-see-more" onClick={onOpenProfile}>
                Открыть профиль
            </button>
        </>
    )
}

export function DesignerSlider({slides, onBrightnessChange}: DesignerSliderProps) {
    const [activeDesigner, setActiveDesigner] = useState<DesignerSlide | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const activeSlide = slides[activeIndex] ?? slides[0]
    const previewSlides = Array.from({length: Math.min(3, Math.max(0, slides.length - 1))}, (_, offset) => {
        const index = (activeIndex + offset + 1) % slides.length
        return {slide: slides[index], index}
    })

    const handleNext = useCallback(() => {
        setActiveIndex((current) => (current + 1) % slides.length)
    }, [slides.length])

    const handlePrev = useCallback(() => {
        setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
    }, [slides.length])

    // ── Drag / swipe ──────────────────────────────────────────
    const dragRef = useRef({active: false, startX: 0})

    useEffect(() => {
        if (activeSlide?.work && onBrightnessChange) sampleBrightness(activeSlide.work, onBrightnessChange)
    }, [activeSlide?.work, onBrightnessChange])

    useEffect(() => {
        const THRESHOLD = 80

        function onStart(x: number) {
            dragRef.current = {active: true, startX: x}
        }

        function onEnd(x: number) {
            if (!dragRef.current.active) return
            dragRef.current.active = false
            const dx = x - dragRef.current.startX
            if (dx < -THRESHOLD) handleNext()
            else if (dx > THRESHOLD) handlePrev()
        }

        // Mouse
        const onMouseDown = (e: MouseEvent) => onStart(e.clientX)
        const onMouseUp = (e: MouseEvent) => onEnd(e.clientX)

        // Touch
        const onTouchStart = (e: TouchEvent) => onStart(e.touches[0].clientX)
        const onTouchEnd = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX)

        const target = document.querySelector<HTMLElement>(".ds-wrap")
        if (!target) return
        target.addEventListener("mousedown", onMouseDown)
        window.addEventListener("mouseup", onMouseUp)
        target.addEventListener("touchstart", onTouchStart, {passive: true})
        target.addEventListener("touchend", onTouchEnd)

        return () => {
            target.removeEventListener("mousedown", onMouseDown)
            window.removeEventListener("mouseup", onMouseUp)
            target.removeEventListener("touchstart", onTouchStart)
            target.removeEventListener("touchend", onTouchEnd)
        }
    }, [handleNext, handlePrev])
    // ─────────────────────────────────────────────────────────

    return (
        <>
            <DesignerProfileModal
                designer={activeDesigner}
                onClose={() => setActiveDesigner(null)}
            />

            <div className="ds-wrap">
                <div className="ds-slide">
                    {activeSlide && (
                        <div
                            key={`active-${slideKey(activeSlide, activeIndex)}`}
                            className="ds-slide-item ds-slide-item--active"
                        >
                            <div
                                className="ds-work-layer"
                                style={{
                                    backgroundImage: `url('${activeSlide.work}')`,
                                    backgroundPosition: activeSlide.workPos,
                                }}
                            />
                            <div className="ds-content">
                                <div className="ds-designer-row">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="ds-avatar" src={activeSlide.avatar ?? activeSlide.portrait}
                                         alt={activeSlide.name} decoding="async"/>
                                    <div>
                                        <div className="ds-name">{activeSlide.name}</div>
                                        <div className="ds-specialty">
                                            <LevelBadge slide={activeSlide}/>
                                            {activeSlide.specialty}
                                        </div>
                                    </div>
                                </div>
                                <div className="ds-meta">
                                    <span>{activeSlide.experience} лет опыта</span>
                                    {activeSlide.has3d && <span>3D</span>}
                                    {activeSlide.hasRd && <span>РД</span>}
                                </div>
                                <div className="ds-meta" style={{marginBottom: 4}}>
                                    <span>Реализовано {activeSlide.sqm} м²</span>
                                </div>
                                <button className="ds-see-more" onClick={e => {
                                    e.stopPropagation();
                                    setActiveDesigner(activeSlide)
                                }}>Открыть профиль
                                </button>
                            </div>
                        </div>
                    )}

                    {previewSlides.length > 0 && (
                        <div className="ds-preview-rail" aria-label="Выбор специалиста">
                            {previewSlides.map(({slide: preview, index}) => (
                                <button
                                    type="button"
                                    key={`preview-${slideKey(preview, index)}`}
                                    className="ds-slide-item ds-slide-item--preview"
                                    style={{backgroundImage: `url('${preview.portrait}')`}}
                                    onClick={() => setActiveIndex(index)}
                                    aria-label={`Показать специалиста ${preview.name}`}
                                >
                                    <div className="ds-card-label">
                                        <div className="ds-card-name">{preview.name}</div>
                                        <div className="ds-card-spec">{preview.specialty.split(" · ")[0]}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                </div>

                {slides[activeIndex] && (
                    <div className="ds-active-overlay" key={activeIndex}>
                        <ActiveDesignerContent
                            slide={slides[activeIndex]}
                            onOpenProfile={() => setActiveDesigner(slides[activeIndex])}
                        />
                    </div>
                )}

                {slides.length > 1 && <div className="ds-nav">
                    <button className="ds-btn ds-btn-prev" onClick={handlePrev}>◁</button>
                    <button className="ds-btn ds-btn-next" onClick={handleNext}>▷</button>
                </div>}

            </div>

            <style>{`
        .ds-wrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .ds-slide {
          position: relative;
          width: 100%;
          height: 100%;
        }

        /* ── Базовая карточка (маленькая, справа) ── */
        .ds-slide-item {
          width: 14vw;
          height: 62vh;
          position: absolute;
          top: 50%;
          transform: translate(0, -50%);
          border-radius: 20px;
          box-shadow: 0 30px 50px #505050;
          background-color: #1a1818;
          background-size: cover;
          background-position: center top;
          display: inline-block;
          transition: all 0.5s;
          overflow: hidden;
        }

        /* ── Позиции маленьких карточек ── */
        .ds-slide .ds-slide-item:nth-child(3) { left: 52%; cursor: pointer; }
        .ds-slide .ds-slide-item:nth-child(4) { left: 67%; cursor: pointer; }
        .ds-slide .ds-slide-item:nth-child(5) { left: 82%; cursor: pointer; }
        .ds-slide .ds-slide-item:nth-child(n + 6) {
          left: 97%;
          opacity: 0;
          pointer-events: none;
        }

        .ds-slide .ds-slide-item:nth-child(3):hover,
        .ds-slide .ds-slide-item:nth-child(4):hover,
        .ds-slide .ds-slide-item:nth-child(5):hover {
          transform: translate(0, -53%);
          box-shadow: 0 40px 60px #303030;
        }

        /* ── Активная карточка (full screen) ── */
        .ds-slide .ds-slide-item:nth-child(1),
        .ds-slide .ds-slide-item:nth-child(2) {
          top: 0;
          left: 0;
          transform: translate(0, 0);
          border-radius: 0;
          width: 100%;
          height: 100%;
          transition: all 0.5s;
          cursor: grab;
        }

        .ds-slide .ds-slide-item:nth-child(2):active {
          cursor: grabbing;
        }

        /* ── Слой с работой (показывается только на full screen) ── */
        .ds-work-layer {
          position: absolute;
          inset: 0;
          background-size: cover;
          opacity: 0;
          transition: opacity 0.5s;
        }

        .ds-slide .ds-slide-item:nth-child(1) .ds-work-layer,
        .ds-slide .ds-slide-item:nth-child(2) .ds-work-layer {
          opacity: 1;
        }

        /* темный оверлей для читаемости текста */
        .ds-slide .ds-slide-item:nth-child(2) .ds-work-layer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.38);
        }

        /* ── Контент активной карточки ── */
        .ds-slide-item .ds-content {
          position: absolute;
          bottom: 80px;
          left: 12vw;
          width: 34vw;
          color: #eee;
          display: none;
          z-index: 2;
        }

        .ds-slide .ds-slide-item:nth-child(2) .ds-content {
          display: block;
        }

        .ds-slide--single .ds-slide-item:nth-child(1) .ds-content {
          display: block;
        }

        .ds-slide--single .ds-slide-item:nth-child(1) .ds-work-layer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.38);
        }

        .ds-designer-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
          opacity: 0;
          animation: ds-animate 1s ease-in-out 0s 1 forwards;
        }

        .ds-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.6);
          flex-shrink: 0;
        }

        .ds-name {
          font-size: clamp(1.4rem, 2.5vw, 2.8rem);
          font-weight: bold;
          line-height: 1.1;
          text-transform: uppercase;
          color: #fff;
          text-shadow:
            0 0 1px rgba(0, 0, 0, 0.95),
            0 0 10px rgba(0, 0, 0, 0.55),
            0 1px 3px rgba(0, 0, 0, 0.9),
            -1px -1px 0 rgba(0, 0, 0, 0.75),
            1px -1px 0 rgba(0, 0, 0, 0.75),
            -1px 1px 0 rgba(0, 0, 0, 0.75),
            1px 1px 0 rgba(0, 0, 0, 0.75);
        }

        .ds-level {
          display: inline-block;
          margin-right: 0.5em;
          padding: 0.15em 0.6em;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.12);
          font-size: 0.72em;
          font-weight: 600;
          letter-spacing: 0.02em;
          vertical-align: middle;
          white-space: nowrap;
        }

        .ds-level--elite {
          border-color: rgba(212, 175, 55, 0.75);
          background: rgba(212, 175, 55, 0.18);
          color: #f0d98c;
        }

        .ds-specialty {
          font-size: clamp(0.75rem, 1vw, 1rem);
          color: rgba(255, 255, 255, 0.92);
          margin-top: 2px;
          text-shadow:
            0 0 1px rgba(0, 0, 0, 0.9),
            0 1px 2px rgba(0, 0, 0, 0.85),
            -1px 0 0 rgba(0, 0, 0, 0.65),
            1px 0 0 rgba(0, 0, 0, 0.65),
            0 1px 0 rgba(0, 0, 0, 0.65);
        }

        .ds-meta {
          display: flex;
          gap: 20px;
          font-size: clamp(0.8rem, 1vw, 1rem);
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 6px;
          text-shadow:
            0 0 1px rgba(0, 0, 0, 0.85),
            0 1px 2px rgba(0, 0, 0, 0.75);
          opacity: 0;
          animation: ds-animate 1s ease-in-out 0.3s 1 forwards;
        }

        .ds-see-more {
          padding: 10px 24px;
          border: none;
          cursor: pointer;
          opacity: 0;
          border-radius: 10px;
          background-color: rgba(255,255,255,0.7);
          transition: all 0.3s;
          animation: ds-animate 1s ease-in-out 0.6s 1 forwards;
          font-size: 0.9rem;
          font-weight: 500;
          pointer-events: auto;
        }

        .ds-see-more:hover {
          background-color: #fff;
        }

        /* ── Подпись на маленькой карточке ── */
        .ds-card-label {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 14px;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
          border-radius: 0 0 20px 20px;
          color: #fff;
          display: block;
        }

        .ds-slide .ds-slide-item:nth-child(1) .ds-card-label,
        .ds-slide .ds-slide-item:nth-child(2) .ds-card-label {
          display: none;
        }

        .ds-card-name {
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow:
            0 0 1px rgba(0, 0, 0, 0.9),
            0 1px 2px rgba(0, 0, 0, 0.8),
            -1px 0 0 rgba(0, 0, 0, 0.6),
            1px 0 0 rgba(0, 0, 0, 0.6);
        }

        .ds-card-spec {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.88);
          margin-top: 2px;
          text-shadow: 0 0 1px rgba(0, 0, 0, 0.85), 0 1px 2px rgba(0, 0, 0, 0.7);
        }

        /* ── Анимация контента ── */
        @keyframes ds-animate {
          from {
            opacity: 0;
            transform: translate(0, 60px);
            filter: blur(16px);
          }
          to {
            opacity: 1;
            transform: translate(0);
            filter: blur(0);
          }
        }

        /* ── Кнопки навигации ── */
        .ds-nav {
          display: flex;
          flex-direction: row;
          gap: 14px;
          position: absolute;
          bottom: 28px;
          left: 45%;
          pointer-events: auto;
          z-index: 10;
        }

        .ds-btn {
          width: 52px;
          height: 46px;
          border-radius: 12px;
          cursor: pointer;
          border: none;
          transition: 0.3s;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          pointer-events: auto;
          font-size: 17px;
          color: #201d1d;
        }

        .ds-btn:hover {
          background: #fff;
          transform: scale(1.1);
          box-shadow: 0 6px 24px rgba(0,0,0,0.3);
        }

        .ds-btn:focus {
          transform: scale(1.1);
          background: #ffffff;
          outline: none;
        }

        .ds-btn:active {
          transform: scale(1.02);
        }

        .ds-btn-next { padding: 0 0 0 3px; }
        .ds-btn-prev { padding: 0 3px 0 0; }

        /* ── Кнопка показать/скрыть карточки ── */
        .ds-toggle {
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 28px;
          height: 56px;
          border: none;
          border-radius: 10px 0 0 10px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          z-index: 10;
          transition: background 0.3s, width 0.3s;
        }

        .ds-toggle:hover {
          background: rgba(255,255,255,0.28);
          width: 34px;
        }

        .ds-toggle-icon {
          display: flex;
          transition: transform 0.4s ease;
        }

        .ds-toggle-icon--hidden {
          transform: rotate(180deg);
        }

        /* ── Скрытие карточек ── */
        .ds-cards-hidden .ds-slide-item:nth-child(3),
        .ds-cards-hidden .ds-slide-item:nth-child(4),
        .ds-cards-hidden .ds-slide-item:nth-child(5),
        .ds-cards-hidden .ds-slide-item:nth-child(n+6) {
          transform: translate(120%, -50%);
          opacity: 0;
          pointer-events: none;
        }

        /* Explicit state-driven layout: one active specialist + up to three previews. */
        .ds-slide .ds-slide-item--active {
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          transform: none;
          border-radius: 0;
          cursor: grab;
        }

        .ds-slide .ds-slide-item--active .ds-work-layer {
          opacity: 1;
        }

        .ds-slide .ds-slide-item--active .ds-work-layer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.38);
        }

        .ds-slide .ds-slide-item--active .ds-content {
          display: block;
        }

        .ds-slide .ds-slide-item--active .ds-card-label {
          display: none;
        }

        .ds-slide .ds-slide-item--preview {
          top: 50%;
          width: 14vw;
          height: 62vh;
          transform: translateY(-50%);
          border-radius: 20px;
          cursor: pointer;
          appearance: none;
          padding: 0;
          border: 0;
          text-align: left;
          z-index: 4;
        }

        .ds-slide .ds-slide-item--preview-1 { left: 52%; }
        .ds-slide .ds-slide-item--preview-2 { left: 67%; }
        .ds-slide .ds-slide-item--preview-3 { left: 82%; }
        .ds-slide .ds-slide-item--preview .ds-card-label { display: block; }

        .ds-slide .ds-slide-item--preview:hover {
          transform: translateY(-53%);
          box-shadow: 0 40px 60px #303030;
        }

        .ds-preview-rail {
          position: absolute;
          top: 50%;
          right: 0;
          z-index: 4;
          display: flex;
          flex-direction: row-reverse;
          align-items: center;
          gap: 1vw;
          transform: translateY(-50%);
        }

        .ds-slide .ds-preview-rail .ds-slide-item--preview {
          position: relative;
          inset: auto;
          flex: 0 0 14vw;
          width: 14vw;
          transform: none;
          margin: 0;
        }

        .ds-slide .ds-preview-rail .ds-slide-item--preview:hover {
          transform: translateY(-3%);
        }

        .ds-cards-hidden .ds-slide-item--preview {
          transform: translate(120%, -50%);
          opacity: 0;
          pointer-events: none;
        }

        /* ── Оверлей активного дизайнера (только мобильный) ── */
        .ds-active-overlay {
          display: none;
        }

        @media (max-width: 768px) {
          .ds-slide-item {
            width: 28vw;
          }

          .ds-slide .ds-slide-item:nth-child(3) { left: 46%; }
          .ds-slide .ds-slide-item:nth-child(4) { left: 76%; }
          .ds-slide .ds-slide-item:nth-child(5) { left: 106%; }

          .ds-slide .ds-slide-item--preview {
            width: 28vw;
          }
          .ds-slide .ds-slide-item--preview-1 { left: 46%; }
          .ds-slide .ds-slide-item--preview-2 { left: 76%; }
          .ds-slide .ds-slide-item--preview-3 { left: 106%; }

          .ds-preview-rail {
            gap: 8px;
          }

          .ds-slide .ds-preview-rail .ds-slide-item--preview {
            flex-basis: 28vw;
            width: 28vw;
          }

          .ds-slide .ds-slide-item .ds-card-label {
            display: none !important;
          }

          .ds-slide .ds-slide-item .ds-content {
            display: none !important;
          }

          .ds-active-overlay {
            display: block;
            position: absolute;
            z-index: 15;
            bottom: 96px;
            left: 20px;
            right: 56px;
            pointer-events: none;
            color: #eee;
          }

          .ds-active-overlay .ds-see-more {
            pointer-events: auto;
          }

          .ds-active-overlay .ds-name {
            font-size: clamp(1.25rem, 5.5vw, 1.75rem);
          }

          .ds-active-overlay .ds-specialty {
            font-size: 0.8rem;
          }

          .ds-active-overlay .ds-meta {
            flex-wrap: wrap;
            gap: 10px 16px;
            font-size: 0.78rem;
          }
        }
      `}</style>
        </>
    )
}
