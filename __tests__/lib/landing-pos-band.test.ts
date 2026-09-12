import {POS_OPTIONS, posBandStyle} from "@/components/Community/landing-uploader/constants"

describe("posBandStyle", () => {
    it("центрирует полосу для «center»", () => {
        // Полоса занимает 45 % кадра, значит по центру её верх — на 27.5 %.
        expect(posBandStyle("center center")).toEqual({top: "27.5%", height: "45%"})
    })

    it("сдвигает полосу вверх и вниз пропорционально проценту", () => {
        expect(posBandStyle("center 20%").top).toBe("11%")
        expect(posBandStyle("center 80%").top).toBe("44%")
    })

    it("поддерживает ключевые слова top/bottom", () => {
        expect(posBandStyle("center top").top).toBe("0%")
        expect(posBandStyle("center bottom").top).toBe("55%")
    })

    it("падает в центр на мусорном значении", () => {
        expect(posBandStyle("center ???")).toEqual(posBandStyle("center center"))
        expect(posBandStyle("center")).toEqual(posBandStyle("center center"))
    })

    it("даёт различимые позиции для всех вариантов интерфейса", () => {
        const tops = POS_OPTIONS.map((o) => posBandStyle(o.value).top)
        expect(new Set(tops).size).toBe(POS_OPTIONS.length)
    })

    it("не выпускает полосу за пределы кадра", () => {
        for (const {value} of POS_OPTIONS) {
            const {top, height} = posBandStyle(value)
            expect(Number.parseFloat(top) + Number.parseFloat(height)).toBeLessThanOrEqual(100)
            expect(Number.parseFloat(top)).toBeGreaterThanOrEqual(0)
        }
    })
})
