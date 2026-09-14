/**
 * @jest-environment jsdom
 */

import {createElement} from "react"
import {cleanup, render, screen, within} from "@testing-library/react"

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({children, href, ...rest}: { children: React.ReactNode; href: string }) =>
        createElement("a", {href, ...rest}, children),
}))

import ProfileCompletenessCard from "@/components/Dashboard/ProfileCompletenessCard"
import {getProfileCompleteness} from "@/lib/profile-completeness"

const EMPTY = {hasAvatar: false, portfolioProjectCount: 0, landingStatuses: []}

describe("getProfileCompleteness", () => {
    test("empty profile has three undone steps", () => {
        const result = getProfileCompleteness(EMPTY)
        expect(result.steps.map((s) => s.id)).toEqual(["avatar", "portfolio", "landing"])
        expect(result.steps.every((s) => !s.done)).toBe(true)
        expect(result).toMatchObject({doneCount: 0, percent: 0, complete: false})
    })

    test("counts each requirement independently", () => {
        expect(getProfileCompleteness({...EMPTY, hasAvatar: true})).toMatchObject({doneCount: 1, percent: 33})
        expect(getProfileCompleteness({...EMPTY, portfolioProjectCount: 2})).toMatchObject({doneCount: 1, percent: 33})
        expect(getProfileCompleteness({...EMPTY, landingStatuses: ["APPROVED"]})).toMatchObject({doneCount: 1})
        expect(getProfileCompleteness({...EMPTY, hasAvatar: true, portfolioProjectCount: 1}))
            .toMatchObject({doneCount: 2, percent: 67, complete: false})
    })

    test("complete when avatar, a portfolio project and an approved landing exist", () => {
        const result = getProfileCompleteness({
            hasAvatar: true,
            portfolioProjectCount: 1,
            landingStatuses: ["REJECTED", "APPROVED"],
        })
        expect(result).toMatchObject({doneCount: 3, percent: 100, complete: true})
    })

    test.each([["DRAFT"], ["REJECTED"]] as const)("a %s landing is not done", (status) => {
        const landing = getProfileCompleteness({...EMPTY, landingStatuses: [status]}).steps[2]
        expect(landing).toMatchObject({done: false, pending: false})
    })

    test("a landing under review is pending, not done", () => {
        const landing = getProfileCompleteness({...EMPTY, landingStatuses: ["PENDING_REVIEW"]}).steps[2]
        expect(landing).toMatchObject({done: false, pending: true})
    })

    test("steps link to the matching cabinet sections", () => {
        expect(getProfileCompleteness(EMPTY).steps.map((s) => s.href)).toEqual([
            "/work/settings",
            "/work/portfolio",
            "/work/landing",
        ])
    })
})

describe("ProfileCompletenessCard", () => {
    afterEach(cleanup)

    test("shows progress and links only for undone steps", () => {
        render(createElement(ProfileCompletenessCard, {
            completeness: getProfileCompleteness({
                hasAvatar: true,
                portfolioProjectCount: 0,
                landingStatuses: ["PENDING_REVIEW"],
            }),
        }))

        expect(screen.getByText("1 из 3")).toBeTruthy()
        expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33")

        const links = screen.getAllByRole("link")
        expect(links.map((a) => a.getAttribute("href"))).toEqual(["/work/portfolio"])

        const landing = screen.getByText("Лендинг").closest("li")!
        expect(within(landing).getByText("На модерации")).toBeTruthy()
        const avatar = screen.getByText("Фото профиля").closest("li")!
        expect(within(avatar).getByText("Готово")).toBeTruthy()
    })
})
