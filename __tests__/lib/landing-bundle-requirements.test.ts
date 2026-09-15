import {
    canSubmitLandingBundle,
    landingRequirements,
    MIN_LANDING_PORTFOLIO,
    missingLandingRequirements,
    type LandingBundleReadiness,
} from "@/lib/landing/bundle-requirements"

const full: LandingBundleReadiness = {
    avatar: true,
    work: true,
    video: true,
    portfolio: MIN_LANDING_PORTFOLIO,
    specialty: true,
    about: true,
}

describe("требования к сборке для главной", () => {
    it("полностью заполненная сборка отправляется", () => {
        expect(missingLandingRequirements(full)).toEqual([])
        expect(canSubmitLandingBundle(full)).toBe(true)
    })

    it("видео-визитка необязательна", () => {
        expect(canSubmitLandingBundle({...full, video: false})).toBe(true)
        expect(missingLandingRequirements({...full, video: false})).toEqual([])
        const video = landingRequirements(full).find((item) => item.key === "video")
        expect(video?.optional).toBe(true)
    })

    it("блокирует отправку без каждого из обязательных пунктов", () => {
        expect(missingLandingRequirements({...full, avatar: false})).toContain("Фото профиля")
        expect(missingLandingRequirements({...full, work: false})).toContain("Фото интерьера")
        expect(missingLandingRequirements({...full, specialty: false})).toContain("Специализация")
        expect(missingLandingRequirements({...full, about: false})).toContain("О себе")
        for (const readiness of [
            {...full, avatar: false},
            {...full, work: false},
            {...full, specialty: false},
            {...full, about: false},
        ]) {
            expect(canSubmitLandingBundle(readiness)).toBe(false)
        }
    })

    it("требует минимум работ в портфолио", () => {
        expect(canSubmitLandingBundle({...full, portfolio: MIN_LANDING_PORTFOLIO - 1})).toBe(false)
        expect(missingLandingRequirements({...full, portfolio: 0})[0]).toContain("минимум")
        // Больше минимума — тоже валидно.
        expect(canSubmitLandingBundle({...full, portfolio: MIN_LANDING_PORTFOLIO + 5})).toBe(true)
    })

    it("перечисляет все незаполненные пункты сразу", () => {
        const empty: LandingBundleReadiness = {
            avatar: false, work: false, video: false, portfolio: 0, specialty: false, about: false,
        }
        expect(missingLandingRequirements(empty)).toHaveLength(5)
    })

    it("показывает счётчик работ в подписи", () => {
        const item = landingRequirements({...full, portfolio: 2}).find((i) => i.key === "portfolio")
        expect(item?.label).toBe(`Портфолио: 2/${MIN_LANDING_PORTFOLIO}`)
        expect(item?.done).toBe(false)
    })
})
