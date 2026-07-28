"use client"

import type { AdminPendingDraft, AdminStageReleaseWave } from "@/lib/stage-admin-release-waves"

export type StageFileLite = {
  id: string
  filename: string
  audience?: string | null
}

export type PreviewOpener = (args: { url: string; filename: string; fileId: string | null; stageId: string }) => void

export type AudienceSetter = (fileId: string, audience: "DESIGNER" | "CLIENT" | "SHARED") => Promise<void>

export type { AdminPendingDraft, AdminStageReleaseWave }

