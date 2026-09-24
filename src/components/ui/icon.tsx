import type {SVGProps} from "react"
import {HugeiconsIcon} from "@hugeicons/react"
import {ICON_MAP, type IconName} from "@/lib/icon-map"

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
    name: IconName
    size?: number | string
    color?: string
    strokeWidth?: number
}

/**
 * Заменяет `<i className="bx bx-XXX"/>` на реальную SVG-иконку Hugeicons.
 * По умолчанию `size="1em"` — иконка масштабируется вместе с окружающим `font-size`
 * (в том числе через className типа `fs-4` или инлайновый `style={{fontSize}}`),
 * как и раньше вело себя шрифтовое подобие иконки.
 */
export function Icon({name, size = "1em", color = "currentColor", strokeWidth = 1.8, ...rest}: Props) {
    const icon = ICON_MAP[name]
    if (!icon) {
        // name чаще всего приходит через stripBx() из конфига/пропа (непроверяемый каст к
        // IconName) — опечатка или пропущенный при миграции с bx-* вариант не должны ронять
        // всю страницу (HugeiconsIcon падает с "not iterable" на undefined).
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[Icon] Нет иконки для имени "${name}" в ICON_MAP`)
        }
        return null
    }
    return (
        <HugeiconsIcon
            icon={icon}
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            {...rest}
        />
    )
}
