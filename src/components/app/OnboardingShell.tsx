"use client"

import {useEffect, useRef} from "react"
import {gsap} from "gsap"
import Image from "next/image"
import {AppHeader} from "./AppHeader"

interface OnboardingShellProps {
    children: React.ReactNode
    title: string
    backHref?: string
    backLabel?: string
    withBg?: boolean
}

export function OnboardingShell({children, title, backHref, backLabel, withBg = false}: OnboardingShellProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const bgRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const tl = gsap.timeline()
        if (withBg && bgRef.current) {
            gsap.set(bgRef.current, {scale: 1.05, opacity: 0})
            tl.to(bgRef.current, {scale: 1, opacity: 1, duration: 1, ease: "power3.out"})
        }
        gsap.set(contentRef.current, {opacity: 0, y: 20})
        tl.to(contentRef.current, {opacity: 1, y: 0, duration: 0.6, ease: "power2.out"}, withBg ? "-=0.5" : "0")
    }, [withBg])

    return (
        <div
            className="min-h-screen relative"
            style={{fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif", background: "#0f1535"}}
        >
            {/* Optional background image */}
            {withBg && (
                <div ref={bgRef} className="fixed inset-0 z-0" style={{opacity: 0}}>
                    <Image src="/osmo-1.avif" alt="" fill className="object-cover" priority/>
                    <div className="absolute inset-0" style={{background: "rgba(15,21,53,0.82)"}}/>
                </div>
            )}

            <AppHeader title={title} backHref={backHref} backLabel={backLabel}/>

            <div
                ref={contentRef}
                className="relative z-10"
                style={{paddingTop: 64}}
            >
                {children}
            </div>
        </div>
    )
}
