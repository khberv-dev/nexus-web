"use client"

import {useEffect, useState} from "react"

export function useWorkViewer(works: string[], designerKey: string) {
    const [workViewerIdx, setWorkViewerIdx] = useState<number | null>(null)
    const viewerOpen = workViewerIdx !== null && workViewerIdx >= 0 && workViewerIdx < works.length
    const activeWork = viewerOpen ? works[workViewerIdx!] : null

    useEffect(() => {
        setWorkViewerIdx(null)
    }, [designerKey])

    useEffect(() => {
        if (!viewerOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (!works.length) return
            if (e.key === "ArrowLeft") {
                setWorkViewerIdx((i) => (i === null ? 0 : (i - 1 + works.length) % works.length))
            }
            if (e.key === "ArrowRight") {
                setWorkViewerIdx((i) => (i === null ? 0 : (i + 1) % works.length))
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [viewerOpen, works.length])

    const goPrev = () => setWorkViewerIdx((i) => (i === null ? 0 : (i - 1 + works.length) % works.length))
    const goNext = () => setWorkViewerIdx((i) => (i === null ? 0 : (i + 1) % works.length))

    return {
        workViewerIdx,
        setWorkViewerIdx,
        viewerOpen,
        activeWork,
        goPrev,
        goNext,
    }
}
