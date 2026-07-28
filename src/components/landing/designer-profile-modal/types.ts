export interface Designer {
  name: string
  specialty: string
  portrait: string
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
}

export type DesignerSlide = Designer

export interface DesignerProfileModalProps {
  designer: Designer | null
  onClose: () => void
}
