"use client"

import * as React from "react"
import {useEffect, useRef} from "react"
import {gsap} from "gsap"
import Image from "next/image"
import Link from "next/link"

export default function AuthLayout({children}: { children: React.ReactNode }) {
    const bgRef = useRef<HTMLDivElement>(null)
    const formRef = useRef<HTMLDivElement>(null)
    const navRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const tl = gsap.timeline()
        gsap.set(bgRef.current, {scale: 1.08, opacity: 0})
        gsap.set(navRef.current, {opacity: 0, y: -16})
        gsap.set(formRef.current, {opacity: 0, y: 32})
        tl.to(bgRef.current, {scale: 1, opacity: 1, duration: 1.2, ease: "power3.out"})
        tl.to(navRef.current, {opacity: 1, y: 0, duration: 0.7, ease: "power2.out"}, "-=0.7")
        tl.to(formRef.current, {opacity: 1, y: 0, duration: 0.8, ease: "power3.out"}, "-=0.4")
    }, [])

    return (
        <div
            className="auth-page-root min-h-screen w-full relative overflow-hidden flex items-center justify-center"
            style={{fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif"}}
        >
            {/* Full-screen background image */}
            <div ref={bgRef} className="absolute inset-0">
                <Image src="/osmo-1.avif" alt="Background" fill className="object-cover" priority/>
                <div className="absolute inset-0" style={{background: "rgba(0,0,0,0.55)"}}/>
            </div>

            <div
                ref={navRef}
                className="auth-nav-shell absolute top-0 left-0 right-0 flex items-center justify-between z-20"
                style={{padding: "2em 3em"}}
            >
                <Link
                    href="/"
                    className="no-underline hover:opacity-70 transition-opacity"
                    style={{color: "#f4f4f4", fontSize: "1.3125em", fontWeight: 500, lineHeight: 1.3}}
                >
                    NEXUS
                </Link>
            </div>

            <div
                ref={formRef}
                className="auth-form-shell relative z-10 w-full"
                style={{maxWidth: 440, padding: "0 1.5rem"}}
            >
                {children}
            </div>

            <style>{`
        @media (max-width: 640px) {
          .auth-page-root {
            align-items: flex-start;
            justify-content: flex-start;
            padding-top: 4.5rem;
            padding-bottom: 2rem;
          }
          .auth-nav-shell {
            padding: 1.25rem 1.1rem !important;
          }
          .auth-form-shell {
            max-width: 100% !important;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
        }
      `}</style>
        </div>
    )
}
