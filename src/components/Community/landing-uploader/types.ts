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
    /** Фото профиля — им карточка показывается на главной. */
    avatarUrl: string | null
    specialty?: string
    about?: string
    onGoToSettings?: () => void
    initialWorkPos?: string
    onReadinessChange?: (state: {
        avatar: boolean
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
    category?: "INTRO_VIDEO" | "LANDING_WORK"
} | null
