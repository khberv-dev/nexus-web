export interface Designer {
    id?: string
    name: string
    specialty: string
    /** Фото профиля: круглый аватар рядом с именем и квадратная карточка в карусели главной. */
    avatar: string | null
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
