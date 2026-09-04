import {METHOD_OPTIONS, SPECIALTY_OPTIONS} from "@/lib/specialist-options"

describe("specialist questionnaire options", () => {
    it("keeps project types in specialization", () => {
        expect(SPECIALTY_OPTIONS).toContain("Офисы и коворкинги")
        expect(SPECIALTY_OPTIONS).toContain("Частные дома и таунхаусы")
        expect(SPECIALTY_OPTIONS).not.toContain("Планировочные решения")
    })

    it("keeps work services in methods", () => {
        expect(METHOD_OPTIONS).toEqual([
            "Планировочные решения",
            "Рабочая документация",
            "3D-визуализация",
            "Световой дизайн",
            "Мебель на заказ",
            "Комплектация объекта",
            "Авторский надзор",
            "Ландшафтный дизайн",
        ])
    })
})
