import type {FileCategory, UserFile} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"

export type LandingBundlePatch = {
    portraitFileId?: string | null
    workFileId?: string | null
    workPos?: string | null
    videoFileId?: string | null
    specialty?: string | null
    about?: string | null
    portfolioFileIds?: string[]
}

const MAX_TEXT = {specialty: 120, about: 2000} as const
const WORK_POS = /^(left|center|right) (top|center|bottom)$/

function optionalId(value: unknown, field: string): string | null | undefined {
    if (value === undefined || value === null) return value
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field} имеет неверный формат`)
    return value.trim()
}

function optionalText(value: unknown, field: keyof typeof MAX_TEXT): string | null | undefined {
    if (value === undefined || value === null) return value
    if (typeof value !== "string") throw new Error(`${field} имеет неверный формат`)
    const text = value.trim()
    if (text.length > MAX_TEXT[field]) throw new Error(`${field}: превышена максимальная длина`)
    return text || null
}

export function parseLandingBundlePatch(body: unknown): LandingBundlePatch {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Некорректное тело запроса")
    const input = body as Record<string, unknown>
    const workPos = optionalId(input.workPos, "workPos")
    if (workPos && !WORK_POS.test(workPos)) throw new Error("workPos имеет неверный формат")

    let portfolioFileIds: string[] | undefined
    if (input.portfolioFileIds !== undefined) {
        if (!Array.isArray(input.portfolioFileIds)) throw new Error("portfolioFileIds должен быть массивом")
        portfolioFileIds = [...new Set(input.portfolioFileIds.map((id) => optionalId(id, "fileId")))]
            .filter((id): id is string => Boolean(id))
        if (portfolioFileIds.length > 3) throw new Error("Для лендинга можно выбрать не более 3 работ")
    }

    return {
        portraitFileId: optionalId(input.portraitFileId, "portraitFileId"),
        workFileId: optionalId(input.workFileId, "workFileId"),
        workPos,
        videoFileId: optionalId(input.videoFileId, "videoFileId"),
        specialty: optionalText(input.specialty, "specialty"),
        about: optionalText(input.about, "about"),
        portfolioFileIds,
    }
}

export async function validateLandingBundleFiles(userId: string, patch: LandingBundlePatch): Promise<void> {
    const expected = new Map<string, FileCategory>()
    if (patch.portraitFileId) expected.set(patch.portraitFileId, "PORTRAIT")
    if (patch.workFileId) expected.set(patch.workFileId, "LANDING_WORK")
    if (patch.videoFileId) expected.set(patch.videoFileId, "INTRO_VIDEO")
    for (const id of patch.portfolioFileIds ?? []) expected.set(id, "PORTFOLIO")
    if (!expected.size) return

    const files = await prisma.userFile.findMany({
        where: {userId, id: {in: [...expected.keys()]}},
        select: {id: true, category: true},
    }) as Pick<UserFile, "id" | "category">[]
    const actual = new Map(files.map((file) => [file.id, file.category]))
    for (const [id, category] of expected) {
        if (actual.get(id) !== category) throw new Error("Выбранный файл не найден или имеет неверную категорию")
    }
}
