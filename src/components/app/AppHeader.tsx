"use client"

import Link from "next/link"

interface AppHeaderProps {
    title: string
    backHref?: string
    backLabel?: string
}

export function AppHeader({title, backHref, backLabel}: AppHeaderProps) {
    return (
        <header
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
            style={{
                padding: "0 3em",
                height: 64,
                background: "rgba(15,21,53,0.7)",
                backdropFilter: "blur(16px)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
            }}
        >
            <div className="flex items-center gap-6">
                <Link href="/" className="no-underline"
                      style={{color: "#f4f4f4", fontSize: "1.1em", fontWeight: 500, lineHeight: 1.3}}>
                    NEXUS
                </Link>
                {backHref && (
                    <>
                        <span style={{color: "rgba(255,255,255,0.2)"}}>/</span>
                        <Link href={backHref} className="no-underline hover:opacity-70 transition-opacity"
                              style={{color: "rgba(255,255,255,0.5)", fontSize: "0.9em"}}>
                            {backLabel}
                        </Link>
                    </>
                )}
                {title && (
                    <>
                        <span style={{color: "rgba(255,255,255,0.2)"}}>/</span>
                        <span style={{color: "#f4f4f4", fontSize: "0.9em"}}>{title}</span>
                    </>
                )}
            </div>

        </header>
    )
}
