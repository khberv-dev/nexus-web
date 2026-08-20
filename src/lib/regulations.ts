import {prisma} from "@/lib/db/prisma"
import {REGULATION_SECTIONS} from "@/lib/onboarding/regulations-default"

/** Единственный документ регламента, который читает специалист на шаге «Ознакомление с регламентом». */
export const REGULATIONS_SLUG = "onboarding"

export const DEFAULT_REGULATIONS_TITLE = "Регламент платформы NEXUS"

/** Дефолтный текст в markdown — из файла в коде, пока администратор не сохранил свою версию. */
export function buildDefaultRegulationsMarkdown(): string {
    return REGULATION_SECTIONS.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n")
}

export type RegulationsDocument = {
    title: string
    content: string
    updatedAt: string | null
    updatedBy: string | null
    /** true — в базе записи ещё нет, показывается текст по умолчанию из кода. */
    isDefault: boolean
}

export async function getRegulationsDocument(): Promise<RegulationsDocument> {
    const doc = await prisma.regulationDocument.findUnique({
        where: {slug: REGULATIONS_SLUG},
        include: {updatedBy: {select: {name: true, email: true}}},
    })

    if (!doc) {
        return {
            title: DEFAULT_REGULATIONS_TITLE,
            content: buildDefaultRegulationsMarkdown(),
            updatedAt: null,
            updatedBy: null,
            isDefault: true,
        }
    }

    return {
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt.toISOString(),
        updatedBy: doc.updatedBy?.name ?? doc.updatedBy?.email ?? null,
        isDefault: false,
    }
}
