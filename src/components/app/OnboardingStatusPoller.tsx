"use client"

import {useEffect, useRef} from "react"
import {useRouter} from "next/navigation"

/** Polls /api/onboarding/status every 8s and refreshes the page when status changes. */
export function OnboardingStatusPoller({currentStatus}: { currentStatus: string }) {
    const router = useRouter()
    const ref = useRef(currentStatus)

    useEffect(() => {
        const id = setInterval(async () => {
            try {
                const res = await fetch("/api/onboarding/status", {cache: "no-store"})
                if (!res.ok) return
                const data = await res.json()
                const status = data?.onboardingStatus
                if (status && status !== ref.current) {
                    ref.current = status
                    router.refresh()
                }
            } catch { /* ignore */
            }
        }, 8000)
        return () => clearInterval(id)
    }, [router])

    return null
}
