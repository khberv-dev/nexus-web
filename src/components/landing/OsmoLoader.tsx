"use client"

import {useEffect, useRef} from "react"
import {gsap} from "gsap"

interface OsmoLoaderProps {
    /** Одобренные изображения специалистов, полученные из БД. null — данные ещё загружаются. */
    images: string[] | null
    /** Анимация логотипа завершена (ещё не уехал с экрана) */
    onAnimationEnd?: () => void
    /** Можно убирать лоадер — медиа и данные готовы */
    canExit?: boolean
    /** Лоадер уехал с экрана */
    onComplete?: () => void
}

export function OsmoLoader({images, onAnimationEnd, canExit = false, onComplete}: OsmoLoaderProps) {
    const loaderRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    const imageWrapRef = useRef<HTMLDivElement>(null)
    const startLettersRef = useRef<HTMLDivElement>(null)
    const endLettersRef = useRef<HTMLDivElement>(null)
    const exitStartedRef = useRef(false)
    const onAnimationEndRef = useRef(onAnimationEnd)
    const onCompleteRef = useRef(onComplete)

    useEffect(() => {
        onAnimationEndRef.current = onAnimationEnd
        onCompleteRef.current = onComplete
    }, [onAnimationEnd, onComplete])

    useEffect(() => {
        if (images === null) return
        const ctx = gsap.context(() => {
            const splashImages = loaderRef.current?.querySelectorAll<HTMLImageElement>(".nexus-splash-image") ?? []
            const tl = gsap.timeline({
                onComplete: () => onAnimationEndRef.current?.(),
            })

            // Initial state
            gsap.set(boxRef.current, {width: 0})
            gsap.set(imageWrapRef.current, {width: "0%"})
            gsap.set(splashImages, {opacity: 0})

            // Step 1: box expands
            tl.to(boxRef.current, {
                width: "1.2em",
                duration: 0.7,
                ease: "power2.inOut",
            })

            // Step 2: image grows inside box
            tl.to(
                imageWrapRef.current,
                {width: "100%", duration: 0.6, ease: "power2.inOut"},
                "-=0.3"
            )

            // Step 3: show approved specialist images one after another between X and U.
            splashImages.forEach((image, index) => {
                tl.to(image, {opacity: 1, duration: 0.01}, index === 0 ? "+=0.1" : "+=0.18")
                if (index > 0) tl.to(splashImages[index - 1], {opacity: 0, duration: 0.01}, "<")
            })

            // Step 4: letters slide out, box collapses
            tl.to(
                startLettersRef.current,
                {xPercent: -100, duration: 0.6, ease: "power3.inOut"},
                "+=0.2"
            )
            tl.to(
                endLettersRef.current,
                {xPercent: 100, duration: 0.6, ease: "power3.inOut"},
                "<"
            )
            tl.to(
                boxRef.current,
                {width: 0, duration: 0.5, ease: "power3.inOut"},
                "<0.1"
            )
        }, loaderRef)

        return () => ctx.revert()
    }, [images])

    useEffect(() => {
        if (!canExit || exitStartedRef.current || !loaderRef.current) return
        exitStartedRef.current = true
        gsap.to(loaderRef.current, {
            yPercent: -100,
            duration: 0.9,
            ease: "power3.inOut",
            onComplete: () => onCompleteRef.current?.(),
        })
    }, [canExit])

    return (
        <div
            ref={loaderRef}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
            style={{background: "#f4f4f4"}}
        >
            {/* Outer clip — hides letters when they slide out */}
            <div className="overflow-hidden flex items-center justify-center select-none"
                 style={{
                     fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
                     fontSize: "clamp(5rem, 12.5vw, 12.5rem)",
                     fontWeight: 500,
                     lineHeight: 0.75,
                     color: "#201d1d",
                     whiteSpace: "nowrap",
                 }}
            >
                {/* Left letters: NEX — slide left on exit */}
                <div
                    ref={startLettersRef}
                    className="flex"
                    style={{justifyContent: "flex-end"}}
                >
                    {"NEX".split("").map((l, i) => (
                        <span key={i} style={{display: "block"}}>{l}</span>
                    ))}
                </div>

                {/* Expanding box with image */}
                <div
                    ref={boxRef}
                    className="flex-shrink-0 overflow-hidden"
                    style={{height: "0.95em", position: "relative", width: 0}}
                >
                    <div
                        ref={imageWrapRef}
                        style={{position: "absolute", inset: 0, width: "0%", overflow: "hidden"}}
                    >
                        {(images ?? []).slice(0, 6).map((src, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={`${src}-${index}`} src={src} alt="" aria-hidden="true"
                                 className="nexus-splash-image absolute inset-0 w-full h-full object-cover"
                                 style={{zIndex: index + 1, opacity: 0}}/>
                        ))}
                    </div>
                </div>

                {/* Right letters: US — slide right on exit */}
                <div
                    ref={endLettersRef}
                    className="flex"
                    style={{justifyContent: "flex-start"}}
                >
                    {"US".split("").map((l, i) => (
                        <span key={i} style={{display: "block"}}>{l}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}
