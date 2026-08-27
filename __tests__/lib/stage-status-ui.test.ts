import {stageStartOwnerHint} from "@/lib/stage-status-ui"

describe("stageStartOwnerHint", () => {
    it("names the specialist for an unstarted stage", () => {
        expect(stageStartOwnerHint("PENDING")).toBe(
            "Начало этапа: специалист должен загрузить первые материалы.",
        )
    })

    it("names the client when payment starts the stage", () => {
        expect(stageStartOwnerHint("AWAITING_PAYMENT")).toBe(
            "Начало этапа: заказчик должен внести оплату.",
        )
    })

    it.each([
        ["CLIENT_REVIEW", "заказчика"],
        ["MOD_REVIEW", "администратора"],
        ["CLIENT_REVISION", "специалиста"],
    ] as const)("derives the owner of a blocked stage from %s", (previousStatus, owner) => {
        expect(stageStartOwnerHint("BLOCKED", previousStatus)).toContain(owner)
    })

    it("does not add a start hint to an active stage", () => {
        expect(stageStartOwnerHint("UPLOADED")).toBeNull()
    })
})
