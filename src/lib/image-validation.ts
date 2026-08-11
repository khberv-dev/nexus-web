import sharp from "sharp"

interface ImageConstraints {
    minWidth?: number
    minHeight?: number
    orientation?: "portrait" | "landscape"
}

const CATEGORY_CONSTRAINTS: Record<string, ImageConstraints> = {
    PORTRAIT: {minWidth: 800, minHeight: 1200, orientation: "portrait"},
    LANDING_WORK: {minWidth: 1920, minHeight: 1080, orientation: "landscape"},
}

export async function validateImageBuffer(buf: Buffer, category: string) {
    const constraints = CATEGORY_CONSTRAINTS[category]
    if (!constraints) return

    const meta = await sharp(buf).metadata()
    if (!meta.width || !meta.height) throw new Error("Не удалось определить размеры изображения")

    const {minWidth, minHeight, orientation} = constraints
    if (minWidth && meta.width < minWidth) throw new Error(`Минимальная ширина ${minWidth}px`)
    if (minHeight && meta.height < minHeight) throw new Error(`Минимальная высота ${minHeight}px`)
    if (orientation === "portrait" && meta.width >= meta.height) throw new Error("Нужна вертикальная фотография")
    if (orientation === "landscape" && meta.height >= meta.width) throw new Error("Нужна горизонтальная фотография")
}
