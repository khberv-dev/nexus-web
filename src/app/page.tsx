"use client"

import {useCallback, useEffect, useState} from "react"
import {OsmoLoader} from "@/components/landing/OsmoLoader"
import {OsmoHeader} from "@/components/landing/OsmoHeader"
import {OsmoHero} from "@/components/landing/OsmoHero"
import {useLandingSlides} from "@/components/landing/hooks/useLandingSlides"

export default function Home() {
    const {slides, ready: mediaReady} = useLandingSlides()
    const [animDone, setAnimDone] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [lightBg, setLightBg] = useState(false)

    const canExitLoader = animDone && mediaReady
    const splashImages = slides === null
        ? null
        : slides.flatMap((slide) => [slide.work, slide.portrait, ...(slide.portfolioImages ?? [])]).filter(Boolean)

    const handleAnimationEnd = useCallback(() => setAnimDone(true), [])

    useEffect(() => {
        if (canExitLoader) setLoaded(true)
    }, [canExitLoader])

    return (
        <>
            {!loaded && (
                <OsmoLoader
                    images={splashImages}
                    canExit={canExitLoader}
                    onAnimationEnd={handleAnimationEnd}
                />
            )}
            <div style={{
                background: "#201d1d",
                minHeight: "100dvh",
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif"
            }}>
                {loaded && slides && (
                    <>
                        <OsmoHeader visible={loaded} lightBg={lightBg}/>
                        <OsmoHero visible={loaded} slides={slides} onBrightnessChange={setLightBg}/>
                    </>
                )}
            </div>
        </>
    )
}
