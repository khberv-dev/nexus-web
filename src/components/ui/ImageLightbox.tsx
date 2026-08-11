"use client"

import {useCallback, useEffect, useState} from "react"

interface Props {
    src: string
    alt?: string
    children: React.ReactNode
    /** Обертка-триггер на всю площадь родителя (плитки, превью в сетке). */
    fillTrigger?: boolean
}

export function ImageLightbox({src, alt = "", children, fillTrigger}: Props) {
    const [open, setOpen] = useState(false)

    const onKey = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
    }, [])

    useEffect(() => {
        if (!open) return
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [open, onKey])

    const triggerStyle = fillTrigger
        ? ({cursor: "zoom-in" as const, display: "block", width: "100%", height: "100%"} as const)
        : ({cursor: "zoom-in" as const} as const)

    return (
        <>
      <span role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true)
          }
      }} style={triggerStyle}>
        {children}
      </span>
            {open && (
                <div onClick={() => setOpen(false)} style={{
                    position: "fixed", inset: 0, zIndex: 10000,
                    background: "rgba(0,0,0,0.85)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 24, cursor: "zoom-out",
                }}>
                    <img src={src} alt={alt} style={{
                        maxWidth: "90vw", maxHeight: "90vh",
                        objectFit: "contain", borderRadius: 8,
                        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                    }}/>
                    <button onClick={() => setOpen(false)} style={{
                        position: "absolute", top: 16, right: 16,
                        width: 36, height: 36, borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.3)",
                        background: "rgba(0,0,0,0.5)", color: "#fff",
                        fontSize: 20, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>×
                    </button>
                </div>
            )}
        </>
    )
}
