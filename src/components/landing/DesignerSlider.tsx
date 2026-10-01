"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {Icon} from "@/components/ui/icon"
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
    return s.id ?? `${s.name}-${s.avatar}-${i}`
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
                <img className="ds-avatar" src={slide.avatar ?? undefined} alt={slide.name} decoding="async"/>
                <div>
                    <div className="ds-name">{slide.name}</div>
                    {slide.levelTitle && <div className="ds-specialty"><LevelBadge slide={slide}/></div>}
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
    const [activeDesigner, setActiveDesigner] = useState<DesignerSlide | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    // Автовоспроизведение без звука — единственное, что браузеры разрешают без жеста пользователя.
    const [muted, setMuted] = useState(true)
    const activeSlide = slides[activeIndex] ?? slides[0]

    const trackRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

    useEffect(() => {
        if (activeSlide?.work && onBrightnessChange) sampleBrightness(activeSlide.work, onBrightnessChange)
    }, [activeSlide?.work, onBrightnessChange])

    // Активный ролик — тот, что занимает большую часть ленты (scroll-snap докручивает до целого).
    useEffect(() => {
        const root = trackRef.current
        if (!root) return
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveIndex(Number((entry.target as HTMLElement).dataset.index))
                    }
                }
            },
            {root, threshold: 0.6},
        )
        itemRefs.current.forEach((el) => el && observer.observe(el))
        return () => observer.disconnect()
    }, [slides.length])

    // Играет только активный ролик; пока открыт профиль (там своё видео со звуком) — лента на паузе.
    const paused = activeDesigner !== null
    useEffect(() => {
        videoRefs.current.forEach((video, i) => {
            if (!video) return
            video.muted = muted
            if (i === activeIndex && !paused) {
                video.play()?.catch(() => {
                    // Звук без жеста пользователя заблокирован — продолжаем без звука.
                    if (!video.muted) {
                        video.muted = true
                        setMuted(true)
                        void video.play().catch(() => undefined)
                    }
                })
            } else {
                video.pause()
                if (i !== activeIndex) video.currentTime = 0
            }
        })
    }, [activeIndex, muted, paused])

    const scrollToIndex = useCallback((index: number) => {
        const track = trackRef.current
        const item = itemRefs.current[index]
        if (!track || !item) return
        track.scrollTo({top: item.offsetTop, behavior: "smooth"})
    }, [])

    const handleNext = useCallback(() => {
        if (activeIndex < slides.length - 1) scrollToIndex(activeIndex + 1)
    }, [activeIndex, slides.length, scrollToIndex])

    const handlePrev = useCallback(() => {
        if (activeIndex > 0) scrollToIndex(activeIndex - 1)
    }, [activeIndex, scrollToIndex])

    useEffect(() => {
        if (paused) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault()
                handleNext()
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                handlePrev()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [paused, handleNext, handlePrev])

    return (
        <>
            <DesignerProfileModal
                designer={activeDesigner}
                onClose={() => setActiveDesigner(null)}
            />

            <div className="ds-wrap">
                {activeSlide && (
                    <div
                        key={`bg-${slideKey(activeSlide, activeIndex)}`}
                        className="ds-work-layer"
                        style={{
                            backgroundImage: `url('${activeSlide.work}')`,
                            backgroundPosition: activeSlide.workPos,
                        }}
                    />
                )}

                {/* Лента роликов в духе Shorts/Reels: вертикальный скролл со snap, по ролику на специалиста. */}
                <div className="ds-reel">
                    <div className="ds-reel-track" ref={trackRef} aria-label="Видео-визитки специалистов">
                        {slides.map((slide, i) => (
                            <div
                                key={`reel-${slideKey(slide, i)}`}
                                ref={(el) => {
                                    itemRefs.current[i] = el
                                }}
                                data-index={i}
                                className="ds-reel-item"
                            >
                                {slide.introVideoUrl ? (
                                    <video
                                        ref={(el) => {
                                            videoRefs.current[i] = el
                                        }}
                                        className="ds-reel-media"
                                        src={slide.introVideoUrl}
                                        poster={slide.avatar ?? slide.work}
                                        muted
                                        loop
                                        playsInline
                                        preload={Math.abs(i - activeIndex) <= 1 ? "auto" : "metadata"}
                                    />
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        className="ds-reel-media"
                                        src={slide.avatar ?? slide.work}
                                        alt={slide.name}
                                        decoding="async"
                                    />
                                )}
                                <div className="ds-reel-shade"/>
                            </div>
                        ))}
                    </div>

                    {activeSlide?.introVideoUrl && (
                        <button
                            type="button"
                            className="ds-mute"
                            onClick={() => setMuted((m) => !m)}
                            aria-label={muted ? "Включить звук" : "Выключить звук"}
                            aria-pressed={!muted}
                        >
                            <Icon name={muted ? "volume-mute" : "volume-full"} size={20}/>
                        </button>
                    )}
                </div>

                {activeSlide && (
                    <div className="ds-info" key={`info-${activeIndex}`}>
                        <ActiveDesignerContent
                            slide={activeSlide}
                            onOpenProfile={() => setActiveDesigner(activeSlide)}
                        />
                    </div>
                )}

                {slides.length > 1 && (
                    <div className="ds-nav">
                        <button
                            className="ds-btn"
                            onClick={handlePrev}
                            disabled={activeIndex === 0}
                            aria-label="Предыдущий дизайнер"
                        >
                            <Icon name="chevron-up" size={20}/>
                        </button>
                        <button
                            className="ds-btn"
                            onClick={handleNext}
                            disabled={activeIndex === slides.length - 1}
                            aria-label="Следующий дизайнер"
                        >
                            <Icon name="chevron-down" size={20}/>
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        .ds-wrap {
          --ds-reel-h: min(calc(100dvh - 180px), 760px);
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        /* ── Фон: работа активного специалиста ── */
        .ds-work-layer {
          position: absolute;
          inset: 0;
          background-size: cover;
          animation: ds-active-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ds-work-layer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.38);
        }

        /* ── Лента роликов справа ── */
        .ds-reel {
          position: absolute;
          top: 50%;
          right: 6vw;
          transform: translateY(-50%);
          height: var(--ds-reel-h);
          aspect-ratio: 9 / 16;
          border-radius: 20px;
          overflow: hidden;
          background: #1a1818;
          box-shadow: 0 30px 60px rgba(0,0,0,0.45);
          z-index: 4;
        }

        .ds-reel-track {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
          scroll-snap-type: y mandatory;
          scrollbar-width: none;
        }

        .ds-reel-track::-webkit-scrollbar {
          display: none;
        }

        .ds-reel-item {
          position: relative;
          height: 100%;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          background: #000;
        }

        .ds-reel-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ds-reel-shade {
          position: absolute;
          inset: auto 0 0 0;
          height: 30%;
          background: linear-gradient(to top, rgba(0,0,0,0.55), transparent);
          pointer-events: none;
        }

        .ds-mute {
          position: absolute;
          right: 14px;
          bottom: 14px;
          z-index: 2;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(8px);
          color: #fff;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }

        .ds-mute:hover {
          background: rgba(0,0,0,0.75);
          transform: scale(1.06);
        }

        /* ── Инфо об активном специалисте (слева внизу) ── */
        .ds-info {
          position: absolute;
          bottom: 80px;
          left: 12vw;
          width: 34vw;
          color: #eee;
          z-index: 5;
          pointer-events: none;
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

        @keyframes ds-active-in {
          from { opacity: 0; transform: scale(1.035); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ── Вверх/вниз по ленте (рядом с роликом) ── */
        .ds-nav {
          position: absolute;
          top: 50%;
          right: calc(6vw + var(--ds-reel-h) * 9 / 16 + 20px);
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 10;
        }

        .ds-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 12px;
          cursor: pointer;
          border: none;
          transition: 0.3s;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          color: #201d1d;
        }

        .ds-btn:hover:not(:disabled) {
          background: #fff;
          transform: scale(1.1);
          box-shadow: 0 6px 24px rgba(0,0,0,0.3);
        }

        .ds-btn:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        .ds-btn:disabled {
          opacity: 0.35;
          cursor: default;
        }

        /* ── Мобильный: лента на весь экран, как в Shorts/Reels; инфо поверх ролика ── */
        @media (max-width: 768px) {
          .ds-reel {
            inset: 0;
            transform: none;
            height: auto;
            aspect-ratio: auto;
            border-radius: 0;
            box-shadow: none;
          }

          .ds-reel-shade {
            height: 45%;
            background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
          }

          .ds-mute {
            bottom: 96px;
            right: 16px;
          }

          .ds-nav {
            display: none;
          }

          .ds-info {
            bottom: 96px;
            left: 20px;
            right: 72px;
            width: auto;
          }

          .ds-info .ds-name {
            font-size: clamp(1.25rem, 5.5vw, 1.75rem);
          }

          .ds-info .ds-specialty {
            font-size: 0.8rem;
          }

          .ds-info .ds-meta {
            flex-wrap: wrap;
            gap: 10px 16px;
            font-size: 0.78rem;
          }
        }
      `}</style>
        </>
    )
}
