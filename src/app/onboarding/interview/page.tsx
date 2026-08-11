"use client"

import {useEffect} from "react"
import {OnboardingShell} from "@/components/app/OnboardingShell"

export default function OnboardingInterviewPage() {
    useEffect(() => {
        const script = document.createElement("script")
        script.src = "https://planerka.app/meet/assets/external/embed.js"
        script.async = true
        document.body.appendChild(script)
        return () => {
            document.body.removeChild(script)
        }
    }, [])

    return (
        <OnboardingShell title="Интервью" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div className="mx-auto max-w-xl px-6 py-12">
                <div className="mb-6">
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.8rem)", fontWeight: 500, margin: 0}}>
                        Шаг 3 — Интервью
                    </h1>
                    <p style={{color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.9rem"}}>
                        Запишитесь на интервью с командой платформы
                    </p>
                </div>

                <div
                    className="app-planerka-embed"
                    data-planerka-embed="default"
                    data-planerka-url="https://planerka.app/meet"
                    data-planerka-user="neksus-z6c2ii"
                    data-planerka-event="30min"
                    data-planerka-bg="transparent"
                    data-planerka-border="#2f4156"
                    data-planerka-shadow-color="#3c2e60"
                    style={{width: "100%", minHeight: 600}}
                />

                <a
                    href="/onboarding"
                    style={{
                        marginTop: "1.5rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.58em 1.15em",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#f4f4f4",
                        textDecoration: "none",
                        fontSize: "0.84rem",
                        fontWeight: 500,
                    }}
                >
                    Следующий шаг →
                </a>
            </div>
        </OnboardingShell>
    )
}
