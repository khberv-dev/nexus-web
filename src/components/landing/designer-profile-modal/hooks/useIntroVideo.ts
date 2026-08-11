"use client"

import {useEffect, useRef, useState} from "react"

export function useIntroVideo(introVideoUrl?: string) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [muted, setMuted] = useState(false)

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        v.muted = false
        setMuted(false)
        const p = v.play()
        if (p) p.catch(() => {
            v.muted = true;
            setMuted(true);
            v.play()
        })
    }, [introVideoUrl])

    const toggleMute = () => {
        const v = videoRef.current
        if (!v) return
        v.muted = !v.muted
        setMuted(v.muted)
    }

    return {videoRef, muted, toggleMute}
}
