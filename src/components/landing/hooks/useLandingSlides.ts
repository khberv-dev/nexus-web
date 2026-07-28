"use client"

import { useEffect, useState } from "react"
import type { DesignerSlide } from "../designer-profile-modal/types"
import { FALLBACK_SLIDES, OSMO_LOADER_IMAGES } from "../constants"
import { preloadSlides } from "@/lib/landing/preloadMedia"

function mergeSlides(data: DesignerSlide[]): DesignerSlide[] {
  const merged = [...data]
  let fi = 0
  while (merged.length < 5 && fi < FALLBACK_SLIDES.length) {
    merged.push(FALLBACK_SLIDES[fi++])
  }
  return merged
}

export function useLandingSlides() {
  const [slides, setSlides] = useState<DesignerSlide[] | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let merged = FALLBACK_SLIDES
      try {
        const res = await fetch("/api/landing/specialists")
        const data: DesignerSlide[] = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          merged = mergeSlides(data)
        }
      } catch {
        /* fallback */
      }

      await preloadSlides(merged, [...OSMO_LOADER_IMAGES], { includeVideos: true })

      if (!cancelled) {
        setSlides(merged)
        setReady(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { slides, ready }
}
