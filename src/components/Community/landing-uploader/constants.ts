/**
 * Требований к разрешению и формату у картинок лендинга нет: дизайнер грузит то, что есть,
 * а кадрирование делает CSS (background-size: cover) и выбор позиции кадра.
 */
export {MAX_LANDING_PORTFOLIO, MIN_LANDING_PORTFOLIO} from "@/lib/landing/bundle-requirements"

export const POS_OPTIONS = [
    {label: "Центр", value: "center center"},
    {label: "Верх", value: "center 20%"},
    {label: "Верх-центр", value: "center 35%"},
    {label: "Низ", value: "center 80%"},
]

/** Доля кадра, которую занимает видимая полоса на схеме выбора положения. */
const POS_BAND_RATIO = 0.45

/** Вертикальная составляющая `background-position` в долях: "center 20%" → 0.2. */
function posVerticalRatio(value: string): number {
    const vertical = value.trim().split(/\s+/)[1] ?? "center"
    if (vertical === "top") return 0
    if (vertical === "bottom") return 1
    if (vertical === "center") return 0.5
    const percent = Number.parseFloat(vertical)
    return Number.isFinite(percent) ? Math.min(Math.max(percent / 100, 0), 1) : 0.5
}

/**
 * Положение видимой полосы на схеме: при `background-size: cover` точка на Y% картинки
 * совмещается с точкой на Y% контейнера, поэтому верх полосы = Y × (1 − высота полосы).
 */
export function posBandStyle(value: string): { top: string; height: string } {
    // Округляем: иначе в inline-стиль попадает вроде «44.00000000000001%».
    const percent = (ratio: number) => `${Math.round(ratio * 10000) / 100}%`
    return {
        top: percent(posVerticalRatio(value) * (1 - POS_BAND_RATIO)),
        height: percent(POS_BAND_RATIO),
    }
}
