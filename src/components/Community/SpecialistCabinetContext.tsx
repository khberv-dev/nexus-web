"use client"

import {createContext, useContext} from "react"
import type {
    OnboardingStep,
    OrderWithRelations,
    PaymentWithRelations,
    SpecAct,
    SpecContract,
} from "./types"

/** Данные кабинета специалиста: грузятся один раз в layout и читаются разделами-страницами. */
export interface SpecialistCabinetData {
    name: string
    email: string
    city?: string
    experience?: string
    software?: string
    about?: string
    status?: string
    orders: OrderWithRelations[]
    payments: PaymentWithRelations[]
    contracts: SpecContract[]
    acts: SpecAct[]
    formData?: Record<string, string> | null
    onboardingSteps: OnboardingStep[]
    featuredOnLanding?: boolean
    landingWorkPos?: string
    /** Текущее фото профиля — обновляется сразу после смены аватара. */
    avatarUrl: string | null
    /** Обновляет avatarUrl сразу после успешной загрузки нового фото (см. AvatarUpload в SettingsCol1). */
    onAvatarChange: (url: string) => void
}

export const SpecialistCabinetContext = createContext<SpecialistCabinetData | null>(null)

export function useSpecialistCabinet(): SpecialistCabinetData {
    const value = useContext(SpecialistCabinetContext)
    if (!value) throw new Error("useSpecialistCabinet must be used inside CommunityPage")
    return value
}
