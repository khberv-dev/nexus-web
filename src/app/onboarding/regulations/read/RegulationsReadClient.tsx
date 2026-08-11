"use client"

import {useMemo, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"
import {REGULATION_SECTIONS} from "../regulations-content"

export default function RegulationsReadClient() {
    const router = useRouter()
    const [confirmed, setConfirmed] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const [scrolledToEnd, setScrolledToEnd] = useState(false)

    const totalChars = useMemo(() => REGULATION_SECTIONS.reduce((s, x) => s + x.body.length, 0), [])

    const onScroll = () => {
        const el = wrapRef.current
        if (!el) return
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
        if (nearBottom) setScrolledToEnd(true)
    }

    const onContinue = async () => {
        if (!confirmed || !scrolledToEnd || submitting) return
        setSubmitting(true)
        try {
            const res = await fetch("/api/onboarding/regulations-read", {method: "POST"})
            if (res.ok) router.push("/onboarding/regulations")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <OnboardingShell title="Регламент" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div className="mx-auto max-w-3xl px-6 py-12">
                <div className="mb-8">
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 500, margin: 0}}>
                        Шаг 4 — Ознакомление с регламентом
                    </h1>
                    <p style={{
                        color: "rgba(255,255,255,0.45)",
                        marginTop: "0.5em",
                        fontSize: "0.9rem",
                        lineHeight: 1.55
                    }}>
                        Перед тестом прочитайте регламент платформы. Пролистайте текст до конца и подтвердите
                        ознакомление.
                    </p>
                    <p style={{color: "rgba(255,255,255,0.35)", marginTop: "0.4em", fontSize: "0.8rem"}}>
                        Объём: ~{Math.max(1, Math.round(totalChars / 1800))} стр.
                    </p>
                </div>

                <AppCard>
                    <div
                        ref={wrapRef}
                        onScroll={onScroll}
                        style={{
                            maxHeight: "62vh",
                            overflow: "auto",
                            paddingRight: 8,
                            scrollBehavior: "smooth",
                        }}
                    >
                        {REGULATION_SECTIONS.map((s, idx) => (
                            <div key={idx} style={{marginBottom: 18}}>
                                <h2 style={{color: "#f4f4f4", fontSize: "1rem", fontWeight: 600, margin: "0 0 8px"}}>
                                    {s.title}
                                </h2>
                                <div style={{
                                    color: "rgba(255,255,255,0.72)",
                                    fontSize: "0.88rem",
                                    lineHeight: 1.65,
                                    whiteSpace: "pre-wrap"
                                }}>
                                    {s.body}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14}}>
                        <label style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            cursor: scrolledToEnd ? "pointer" : "not-allowed"
                        }}>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                disabled={!scrolledToEnd}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                style={{marginTop: 3}}
                            />
                            <span style={{
                                color: scrolledToEnd ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)",
                                fontSize: "0.85rem",
                                lineHeight: 1.45
                            }}>
                Я ознакомился(ась) с регламентом и обязуюсь соблюдать правила платформы.
                                {!scrolledToEnd && (
                                    <span style={{
                                        display: "block",
                                        marginTop: 4,
                                        color: "rgba(255,255,255,0.28)",
                                        fontSize: "0.8rem"
                                    }}>
                    Пролистайте текст до конца, чтобы активировать подтверждение.
                  </span>
                                )}
              </span>
                        </label>

                        <button
                            type="button"
                            onClick={onContinue}
                            disabled={!confirmed || !scrolledToEnd || submitting}
                            style={{
                                width: "100%",
                                marginTop: 12,
                                padding: "0.85em 1.5em",
                                borderRadius: 999,
                                border: "1px solid rgba(52,211,153,0.35)",
                                background: confirmed && scrolledToEnd ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
                                color: confirmed && scrolledToEnd ? "#6ee7b7" : "rgba(255,255,255,0.35)",
                                fontWeight: 600,
                                fontSize: "0.9rem",
                                cursor: confirmed && scrolledToEnd && !submitting ? "pointer" : "default",
                                opacity: submitting ? 0.75 : 1,
                            }}
                        >
                            {submitting ? "Сохранение…" : "Перейти к тесту →"}
                        </button>
                    </div>
                </AppCard>
            </div>
        </OnboardingShell>
    )
}

