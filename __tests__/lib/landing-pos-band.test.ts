import {percentToWorkPos, workPosToPercent} from "@/components/Community/landing-uploader/constants"

describe("workPosToPercent", () => {
    it("переводит ключевые слова в проценты по обеим осям", () => {
        expect(workPosToPercent("left top")).toEqual({x: 0, y: 0})
        expect(workPosToPercent("center center")).toEqual({x: 50, y: 50})
        expect(workPosToPercent("right bottom")).toEqual({x: 100, y: 100})
    })

    it("переводит явные проценты по X и Y независимо", () => {
        expect(workPosToPercent("20% 80%")).toEqual({x: 20, y: 80})
        expect(workPosToPercent("70% 30%")).toEqual({x: 70, y: 30})
    })

    it("округляет и ограничивает диапазон 0..100 по каждой оси", () => {
        expect(workPosToPercent("33.6% 150%")).toEqual({x: 34, y: 100})
        expect(workPosToPercent("-20% 40%")).toEqual({x: 0, y: 40})
    })

    it("падает в центр на мусорном или неполном значении", () => {
        expect(workPosToPercent("center ???")).toEqual({x: 50, y: 50})
        expect(workPosToPercent("center")).toEqual({x: 50, y: 50})
        expect(workPosToPercent("")).toEqual({x: 50, y: 50})
    })
})

describe("percentToWorkPos", () => {
    it("собирает валидную строку background-position из двух осей", () => {
        expect(percentToWorkPos({x: 37, y: 62})).toBe("37% 62%")
        expect(percentToWorkPos({x: 0, y: 0})).toBe("0% 0%")
        expect(percentToWorkPos({x: 100, y: 100})).toBe("100% 100%")
    })

    it("округляет и ограничивает диапазон 0..100 по каждой оси", () => {
        expect(percentToWorkPos({x: 33.6, y: -20})).toBe("34% 0%")
        expect(percentToWorkPos({x: 150, y: 50})).toBe("100% 50%")
    })

    it("является обратной операцией для workPosToPercent", () => {
        for (const pos of [{x: 0, y: 0}, {x: 12, y: 87}, {x: 50, y: 50}, {x: 100, y: 0}]) {
            expect(workPosToPercent(percentToWorkPos(pos))).toEqual(pos)
        }
    })
})
