"use client"

import type { OnboardingStatus } from "@/components/app/SpecialistCard"
import type { RawSpecialist } from "../../types"
import {
  FilesCard,
  OnboardingStepsTableCard,
  PlatformContractCard,
  RatingLandingCard,
} from "./cards"

type OnboardingStepRow = NonNullable<RawSpecialist["specialistProfile"]>["steps"][number]

export function SpecialistContractTab({
  specialist,
  onRefresh,
}: {
  specialist: RawSpecialist
  onRefresh?: () => Promise<void>
}) {
  const prof = specialist.specialistProfile
  return (
    <div style={{ maxWidth: 920 }}>
      <PlatformContractCard specialist={specialist} profile={prof} onRefresh={onRefresh} />
    </div>
  )
}

export function SpecialistOnboardingStepsTab({
  steps,
  formData,
}: {
  steps: OnboardingStepRow[]
  formData?: Record<string, string> | null
}) {
  return (
    <div style={{ maxWidth: 920 }}>
      <OnboardingStepsTableCard steps={steps} formData={formData} />
    </div>
  )
}

export function SpecialistRatingLandingTab({
  specialistId,
  profile,
  onboardingStatus,
  ratingUpdating,
  onUpdateProfile,
}: {
  specialistId: string
  profile?: RawSpecialist["specialistProfile"] | null
  onboardingStatus: OnboardingStatus
  ratingUpdating: boolean
  onUpdateProfile: (userId: string, patch: { rating?: number; featuredOnLanding?: boolean }) => void
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <RatingLandingCard
        specialistId={specialistId}
        profile={profile}
        onboardingStatus={onboardingStatus}
        ratingUpdating={ratingUpdating}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  )
}

export function SpecialistFilesTab({ files }: { files: RawSpecialist["files"] }) {
  if (!files.length) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--adm-muted)", margin: 0 }}>
        У специалиста нет загруженных файлов (категории портфолио, аватар, документы и т.д.).
      </p>
    )
  }
  return (
    <div style={{ maxWidth: 920 }}>
      <FilesCard files={files} />
    </div>
  )
}
