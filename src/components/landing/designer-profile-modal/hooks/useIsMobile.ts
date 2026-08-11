"use client"

import {useEffect, useState} from "react"

const MOBILE_QUERY = "(max-width: 768px)"

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_QUERY)
        const apply = () => setIsMobile(mq.matches)
        apply()
        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", apply)
            return () => mq.removeEventListener("change", apply)
        }
        mq.addListener?.(apply)
        return () => mq.removeListener?.(apply)
    }, [])

    return isMobile
}
