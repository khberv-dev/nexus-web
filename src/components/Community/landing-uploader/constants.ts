/**
 * Требований к разрешению и формату у картинок лендинга нет: дизайнер грузит то, что есть,
 * а кадрирование делает CSS (background-size: cover) и выбор положения кадра.
 */
export {MAX_LANDING_PORTFOLIO, MIN_LANDING_PORTFOLIO} from "@/lib/landing/bundle-requirements"

export const DEFAULT_WORK_POS = "50% 50%"

export interface WorkPosPercent {
    x: number
    y: number
}

function axisToPercent(token: string | undefined, startKeyword: string, endKeyword: string): number {
    if (token === startKeyword) return 0
    if (token === endKeyword) return 100
    if (token === "center" || token === undefined) return 50
    const n = Number.parseFloat(token)
    return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 100) : 50
}

/** `background-position` в X/Y% — "left top" → {x:0,y:0}, "70% 30%" → {x:70,y:30}. */
export function workPosToPercent(value: string): WorkPosPercent {
    const [xToken, yToken] = value.trim().split(/\s+/)
    return {
        x: axisToPercent(xToken, "left", "right"),
        y: axisToPercent(yToken, "top", "bottom"),
    }
}

export function percentToWorkPos({x, y}: WorkPosPercent): string {
    const clamp = (n: number) => Math.min(Math.max(Math.round(n), 0), 100)
    return `${clamp(x)}% ${clamp(y)}%`
}
