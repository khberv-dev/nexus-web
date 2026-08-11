export interface LandingFile {
    id: string
    s3Key: string
    filename: string
    mimeType: string | null
    category: string
    landingOrder: number | null
    createdAt: string
}

export interface LandingUploaderProps {
    featuredOnLanding?: boolean
    specialty?: string
    about?: string
    onGoToSettings?: () => void
    initialWorkPos?: string
    onReadinessChange?: (state: {
        portrait: boolean
        work: boolean
        video: boolean
        portfolio: number
        specialty: boolean
        about: boolean
    }) => void
}

export type PreviewState = {
    url: string
    kind: "image" | "video"
    title: string
    fileId?: string
    category?: "PORTRAIT" | "INTRO_VIDEO" | "LANDING_WORK"
} | null
