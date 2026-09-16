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
    portfolioProjectsCount: number
    formData?: Record<string, string> | null
    onboardingSteps: OnboardingStep[]
    featuredOnLanding?: boolean
    landingWorkPos?: string
    /** Текущее фото профиля — обновляется сразу после смены аватара в шапке кабинета. */
    avatarUrl: string | null
}

/** id файлового input аватара в шапке: разделы открывают выбор фото через <label htmlFor>. */
export const SPECIALIST_AVATAR_INPUT_ID = "specialist-avatar-input"

export const SpecialistCabinetContext = createContext<SpecialistCabinetData | null>(null)

export function useSpecialistCabinet(): SpecialistCabinetData {
    const value = useContext(SpecialistCabinetContext)
    if (!value) throw new Error("useSpecialistCabinet must be used inside CommunityPage")
    return value
}
