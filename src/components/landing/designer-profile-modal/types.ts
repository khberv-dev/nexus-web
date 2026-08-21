export interface Designer {
    name: string
    specialty: string
    portrait: string
    /** Круглый аватар рядом с именем; портрет может быть крупным фото на всю карточку. */
    avatar?: string | null
    work: string
    workPos?: string
    experience: number
    sqm: number
    style: string
    has3d: boolean
    hasRd: boolean
    bio?: string
    introVideoUrl?: string
    portfolioImages?: string[]
    /** Код уровня квалификационного теста: L1…L4. */
    level?: string | null
    /** Подпись уровня для интерфейса: «Мастер-дизайнер», «Элита». */
    levelTitle?: string | null
}

export type DesignerSlide = Designer

export interface DesignerProfileModalProps {
    designer: Designer | null
    onClose: () => void
}
