import type { OnboardingStatus } from "@/components/app/SpecialistCard"

/** Вкладки карточки специалиста: основной блок, договор, шаги, оценка, файлы, портфолио ЛК, заказы. */
export type SpecialistDetailTab =
  | "main"
  | "contract"
  | "onboarding"
  | "rating"
  | "files"
  | "portfolio"
  | "orders"

export interface RawSpecialist {
  id: string
  email: string
  name: string | null
  phone: string | null
  archivedAt: string | null
  createdAt: string
  specialistProfile: {
    id: string
    createdAt: string
    specialistContractS3Key?: string | null
    specialistContractStatus?: string
    specialistContractNumber?: string | null
    specialistContractUploadedAt?: string | null
    specialistSignedContractS3Key?: string | null
    specialistSignedContractUploadedAt?: string | null
    onboardingStatus: OnboardingStatus
    formData: Record<string, string> | null
    steps: { type: string; status: string; comment: string | null; updatedAt: string }[]
    rating: number | null
    featuredOnLanding: boolean
    bio: string | null
    videoUrl: string | null
    landingWorkPos: string | null
  } | null
  files: { id: string; category: string; filename?: string }[]
}

export type SpecialistOrder = {
  id: string
  status: string
  title: string | null
  briefData: Record<string, string> | null
  client: { email: string; name: string | null }
}

export type TestModalData = {
  answers: Record<string, number>
  comment: string | null
  meta?: { correctCount: number; percent: number; passed: boolean; passPercent: number } | null
}
