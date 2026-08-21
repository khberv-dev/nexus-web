"use client"

import {useEffect, useState} from "react"
import type {DesignerSlide} from "../designer-profile-modal/types"
import {OSMO_LOADER_IMAGES} from "../constants"
import {preloadSlides} from "@/lib/landing/preloadMedia"

/**
 * Слайды главной — только реальные дизайнеры платформы (/api/landing/specialists).
 * Демо-персонажами список намеренно не добиваем: на главной должны быть живые
 * специалисты с портфолио, пустой список честнее выдуманного.
 */
export function useLandingSlides() {
    const [slides, setSlides] = useState<DesignerSlide[] | null>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function load() {
            let real: DesignerSlide[] = []
            try {
                const res = await fetch("/api/landing/specialists")
                const data: DesignerSlide[] = await res.json()
                if (Array.isArray(data)) real = data
            } catch {
                /* сеть/сервер недоступны — покажем пустую главную, а не выдуманных людей */
            }

            await preloadSlides(real, [...OSMO_LOADER_IMAGES], {includeVideos: true})

            if (!cancelled) {
                setSlides(real)
                setReady(true)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [])

    return {slides, ready}
}
