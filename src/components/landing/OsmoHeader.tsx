"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import Link from "next/link"
import { useSession } from "next-auth/react"

interface OsmoHeaderProps {
  visible: boolean
  lightBg: boolean
}

export function OsmoHeader({ visible, lightBg }: OsmoHeaderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { status } = useSession()
  const signedIn = status === "authenticated"
  const entryHref = signedIn ? "/auth/continue" : "/login"
  const entryLabel = signedIn ? "Кабинет" : "Войти"

  useEffect(() => {
    if (!visible) return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: -16 },
      { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", delay: 0.1 }
    )
  }, [visible])

  if (!visible) return null

  const color = lightBg ? "#201d1d" : "#f4f4f4"

  return (
    <nav
      ref={ref}
      className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between"
      style={{
        padding: "2.5em 3em",
        fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
        opacity: 0,
      }}
    >
      <Link
        href="#"
        className="no-underline"
        style={{
          color,
          fontSize: "2.6em",
          lineHeight: 1.2,
          fontWeight: 600,
          transition: "color 0.6s ease",
          textShadow: lightBg ? "none" : "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        NEXUS
      </Link>

      <Link
        href={entryHref}
        className="no-underline"
        style={{
          color: lightBg ? "#fff" : "#201d1d",
          fontSize: "1.05rem",
          fontWeight: 600,
          padding: "0.65em 2em",
          borderRadius: "100px",
          border: "none",
          background: lightBg ? "#201d1d" : "#f4f4f4",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          transition: "color 0.6s ease, background 0.6s ease, box-shadow 0.3s ease, transform 0.2s ease",
          letterSpacing: "0.02em",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = "scale(1.05)"
          el.style.boxShadow = "0 6px 28px rgba(0,0,0,0.35)"
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = "scale(1)"
          el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"
        }}
      >
        {entryLabel}
      </Link>
    </nav>
  )
}
