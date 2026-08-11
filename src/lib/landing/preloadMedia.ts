import type {DesignerSlide} from "@/components/landing/designer-profile-modal/types"

const DEFAULT_TIMEOUT_MS = 14_000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ])
}

export function preloadImage(src: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    if (!src) return Promise.resolve()
    return withTimeout(
        new Promise<void>((resolve) => {
            const img = new Image()
            const finish = () => resolve()
            img.onload = finish
            img.onerror = finish
            img.src = src
        }),
        timeoutMs,
        undefined,
    )
}

export function preloadVideo(src: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    if (!src) return Promise.resolve()
    return withTimeout(
        new Promise<void>((resolve) => {
            const video = document.createElement("video")
            const finish = () => {
                video.removeAttribute("src")
                video.load()
                resolve()
            }
            video.preload = "auto"
            video.muted = true
            video.playsInline = true
            video.onloadeddata = finish
            video.onerror = finish
            video.src = src
        }),
        timeoutMs,
        undefined,
    )
}

export function collectSlideMediaUrls(slides: DesignerSlide[], opts?: { includeVideos?: boolean }) {
    const urls = new Set<string>()
    for (const s of slides) {
        if (s.portrait) urls.add(s.portrait)
        if (s.work) urls.add(s.work)
        if (opts?.includeVideos && s.introVideoUrl) urls.add(s.introVideoUrl)
        for (const img of s.portfolioImages ?? []) {
            if (img) urls.add(img)
        }
    }
    return [...urls]
}

export async function preloadSlides(
    slides: DesignerSlide[],
    extraImages: string[] = [],
    opts?: { includeVideos?: boolean },
) {
    const images = [...extraImages]
    for (const s of slides) {
        if (s.portrait) images.push(s.portrait)
        if (s.work) images.push(s.work)
    }
    await Promise.all(images.map((src) => preloadImage(src)))

    if (opts?.includeVideos) {
        const videos = slides.map((s) => s.introVideoUrl).filter(Boolean) as string[]
        await Promise.all(videos.map((src) => preloadVideo(src)))
    }
}
