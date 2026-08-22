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
                {slide.hasRd && <span>РД</span>}
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
    const slideRef = useRef<HTMLDivElement>(null)
    const [cardsVisible, setCardsVisible] = useState(true)
    const [activeDesigner, setActiveDesigner] = useState<DesignerSlide | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const activeDomIndex = slides.length === 1 ? 0 : 1

    const syncActiveSlide = useCallback(() => {
        const container = slideRef.current
        if (!container || !slides.length) return
        const activeEl = container.querySelectorAll<HTMLDivElement>(".ds-slide-item")[activeDomIndex]
        if (!activeEl) return
        const idx = Number(activeEl.dataset.slideIdx)
        if (!Number.isNaN(idx) && idx >= 0 && idx < slides.length) {
            setActiveIndex(idx)
        }
    }, [activeDomIndex, slides])

    const rotateNext = useCallback(() => {
        const slide = slideRef.current
        if (!slide) return
        const items = slide.querySelectorAll<HTMLDivElement>(".ds-slide-item")
        if (items.length) slide.appendChild(items[0])
        syncActiveSlide()
    }, [syncActiveSlide])

    const rotatePrev = useCallback(() => {
        const slide = slideRef.current
        if (!slide) return
        const items = slide.querySelectorAll<HTMLDivElement>(".ds-slide-item")
        if (items.length) slide.prepend(items[items.length - 1])
        syncActiveSlide()
    }, [syncActiveSlide])

    const handleNext = rotateNext
    const handlePrev = rotatePrev

    // ── Drag / swipe ──────────────────────────────────────────
    const dragRef = useRef({active: false, startX: 0})

    // Синхронизация активного слайда + яркость шапки
    useEffect(() => {
        const slide = slideRef.current
        if (!slide) return

        function onSlideChange() {
            syncActiveSlide()
            if (!onBrightnessChange) return
            const active = slide!.querySelectorAll<HTMLDivElement>(".ds-slide-item")[activeDomIndex]
            if (!active) return
            const workLayer = active.querySelector<HTMLDivElement>(".ds-work-layer")
            const bg = workLayer?.style.backgroundImage ?? active.style.backgroundImage
            const match = bg.match(/url\(['"]?([^'"]+)['"]?\)/)
            if (match) sampleBrightness(match[1], onBrightnessChange)
        }

        onSlideChange()
        const observer = new MutationObserver(onSlideChange)
        observer.observe(slide, {childList: true})
        return () => observer.disconnect()
    }, [activeDomIndex, onBrightnessChange, syncActiveSlide])

    useEffect(() => {
        syncActiveSlide()
    }, [slides, syncActiveSlide])

    useEffect(() => {
        const slide = slideRef.current
        if (!slide) return

        const THRESHOLD = 80

        function getActiveItem() {
            return slide!.querySelectorAll<HTMLDivElement>(".ds-slide-item")[activeDomIndex] ?? null
        }

        function onStart(x: number) {
            dragRef.current = {active: true, startX: x}
            const active = getActiveItem()
            if (active) active.style.transition = "none"
        }

        function onMove(x: number) {
            if (!dragRef.current.active) return
            const dx = x - dragRef.current.startX
            const active = getActiveItem()
            if (active) active.style.transform = `translateX(${dx}px)`
        }

        function onEnd(x: number) {
            if (!dragRef.current.active) return
            dragRef.current.active = false
            const dx = x - dragRef.current.startX
            const active = getActiveItem()

            if (active) {
                active.style.transition = ""
                active.style.transform = ""
            }

            if (dx < -THRESHOLD) {
                const items = slide!.querySelectorAll<HTMLDivElement>(".ds-slide-item")
                slide!.appendChild(items[0])
                syncActiveSlide()
            } else if (dx > THRESHOLD) {
                const items = slide!.querySelectorAll<HTMLDivElement>(".ds-slide-item")
                slide!.prepend(items[items.length - 1])
                syncActiveSlide()
            }
        }

        // Mouse
        const onMouseDown = (e: MouseEvent) => onStart(e.clientX)
        const onMouseMove = (e: MouseEvent) => onMove(e.clientX)
        const onMouseUp = (e: MouseEvent) => onEnd(e.clientX)

        // Touch
        const onTouchStart = (e: TouchEvent) => onStart(e.touches[0].clientX)
        const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX)
        const onTouchEnd = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX)

        slide.addEventListener("mousedown", onMouseDown)
        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
        slide.addEventListener("touchstart", onTouchStart, {passive: true})
        slide.addEventListener("touchmove", onTouchMove, {passive: true})
        slide.addEventListener("touchend", onTouchEnd)

        return () => {
            slide.removeEventListener("mousedown", onMouseDown)
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
            slide.removeEventListener("touchstart", onTouchStart)
            slide.removeEventListener("touchmove", onTouchMove)
            slide.removeEventListener("touchend", onTouchEnd)
        }
    }, [activeDomIndex, syncActiveSlide])
    // ─────────────────────────────────────────────────────────

    const handleClickItem = useCallback((el: HTMLDivElement) => {
        const slide = slideRef.current
        if (!slide) return
        const items = Array.from(slide.querySelectorAll<HTMLDivElement>(".ds-slide-item"))
        const idx = items.indexOf(el)
        // idx === 1 — уже активна, idx === 0 — предыдущая (не трогаем маленькие)
        if (idx <= 1) return
        // двигаем items[0] в конец (idx - 1) раз, чтобы el стала nth-child(2)
        for (let i = 0; i < idx - 1; i++) {
            const current = slide.querySelectorAll<HTMLDivElement>(".ds-slide-item")
            slide.appendChild(current[0])
        }
        syncActiveSlide()
    }, [syncActiveSlide])

    return (
        <>
            <DesignerProfileModal
                designer={activeDesigner}
                onClose={() => setActiveDesigner(null)}
            />

            <div className={`ds-wrap${cardsVisible ? "" : " ds-cards-hidden"}`}>
                <div ref={slideRef} className={`ds-slide${slides.length === 1 ? " ds-slide--single" : ""}`}>
                    {slides.map((s, i) => (
                        <div
                            key={slideKey(s, i)}
                            data-slide-idx={i}
                            className="ds-slide-item"
                            style={{backgroundImage: `url('${s.portrait}')`}}
                            onClick={(e) => handleClickItem(e.currentTarget)}
                        >
                            {/* Работа — видна только когда карточка активна (full screen) */}
                            <div
                                className="ds-work-layer"
                                style={{
                                    backgroundImage: `url('${s.work}')`,
                                    backgroundPosition: s.workPos,
                                }}
                            />

                            {/* Контент на активной карточке */}
                            <div className="ds-content">
                                <div className="ds-designer-row">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="ds-avatar" src={s.avatar ?? s.portrait} alt={s.name} decoding="async"/>
                                    <div>
                                        <div className="ds-name">{s.name}</div>
                                        <div className="ds-specialty">
                                            <LevelBadge slide={s}/>
                                            {s.specialty}
                                        </div>
                                    </div>
                                </div>
                                <div className="ds-meta">
                                    <span>{s.experience} лет опыта</span>
                                    {s.has3d && <span>3D</span>}
                                    {s.hasRd && <span>РД</span>}
                                </div>
                                <div className="ds-meta" style={{marginBottom: 4}}>
                                    <span>Реализовано {s.sqm} м²</span>
                                </div>
                                <button className="ds-see-more" onClick={e => {
                                    e.stopPropagation();
                                    setActiveDesigner(s)
                                }}>Открыть профиль
                                </button>
                            </div>

                            {/* Подпись на маленькой карточке */}
                            <div className="ds-card-label">
                                <div className="ds-card-name">{s.name}</div>
                                <div className="ds-card-spec">{s.specialty.split(" · ")[0]}</div>
                            </div>
                        </div>
                    ))}
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

                <button
                    className="ds-toggle"
                    onClick={() => setCardsVisible(v => !v)}
                    title={cardsVisible ? "Скрыть дизайнеров" : "Показать дизайнеров"}
                >
          <span className={`ds-toggle-icon${cardsVisible ? "" : " ds-toggle-icon--hidden"}`}>
            {/* двойная стрелка вправо / влево */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                   strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
          </span>
                </button>
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
