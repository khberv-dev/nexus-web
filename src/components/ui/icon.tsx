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
    return (
        <HugeiconsIcon
            icon={ICON_MAP[name]}
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            {...rest}
        />
    )
}
