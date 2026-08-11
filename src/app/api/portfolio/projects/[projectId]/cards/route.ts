import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {type AttachmentCreateSpec, validateAttachmentSpecsForNewCard} from "@/lib/portfolioCreateAttachments"

async function checkProject(projectId: string, userId: string) {
    return prisma.portfolioProject.findFirst({
        where: {id: projectId, userId},
        select: {id: true},
    })
}

export async function GET(_req: NextRequest, {params}: { params: Promise<{ projectId: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getOrCreateDbUser(user)
    const {projectId} = await params
    const project = await checkProject(projectId, dbUser.id)
    if (!project) return NextResponse.json({error: "Not found"}, {status: 404})

    const cards = await prisma.portfolioCard.findMany({
        where: {projectId},
        orderBy: {createdAt: "desc"},
        select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            mainFile: {
                select: {
                    id: true,
                    filename: true,
                    mimeType: true,
                    title: true,
                },
            },
            attachments: {
                select: {
                    id: true,
                    linkedVisualFileId: true,
                    file: {
                        select: {id: true, filename: true, mimeType: true, title: true},
                    },
                },
            },
        },
    })

    return NextResponse.json(cards)
}

export async function POST(req: NextRequest, {params}: { params: Promise<{ projectId: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getOrCreateDbUser(user)
    const {projectId} = await params
    const project = await checkProject(projectId, dbUser.id)
    if (!project) return NextResponse.json({error: "Not found"}, {status: 404})

    const body = (await req.json()) as {
        title?: string
        description?: string | null
        mainFileId?: string | null
        attachmentFileIds?: string[]
        attachmentSpecs?: AttachmentCreateSpec[]
    }

    const title = body.title?.trim()
    if (!title) return NextResponse.json({error: "Укажите название работы"}, {status: 400})

    const attachmentSpecs: AttachmentCreateSpec[] | undefined = (() => {
        if (body.attachmentSpecs?.length) {
            const byFile = new Map<string, AttachmentCreateSpec>()
            for (const s of body.attachmentSpecs) {
                if (s?.fileId) byFile.set(s.fileId, {
                    fileId: s.fileId,
                    linkedVisualFileId: s.linkedVisualFileId ?? null
                })
            }
            return [...byFile.values()]
        }
        if (body.attachmentFileIds?.length) {
            return Array.from(new Set(body.attachmentFileIds)).map((fileId) => ({
                fileId,
                linkedVisualFileId: null as string | null,
            }))
        }
        return undefined
    })()

    const fileIds = [body.mainFileId, ...(attachmentSpecs?.map((s) => s.fileId) ?? [])].filter(Boolean) as string[]
    if (fileIds.length > 0) {
        const owned = await prisma.userFile.count({
            where: {id: {in: fileIds}, userId: dbUser.id},
        })
        if (owned !== new Set(fileIds).size) {
            return NextResponse.json({error: "Invalid file ownership"}, {status: 400})
        }
    }

    if (attachmentSpecs?.length) {
        try {
            await validateAttachmentSpecsForNewCard(dbUser.id, body.mainFileId ?? null, attachmentSpecs)
        } catch (e) {
            return NextResponse.json({error: (e as Error).message}, {status: 400})
        }
    }

    const card = await prisma.portfolioCard.create({
        data: {
            projectId,
            title,
            description: body.description?.trim() || null,
            mainFileId: body.mainFileId ?? null,
            attachments: attachmentSpecs?.length
                ? {
                    create: attachmentSpecs.map((s) => ({
                        fileId: s.fileId,
                        linkedVisualFileId: s.linkedVisualFileId ?? null,
                    })),
                }
                : undefined,
        },
        select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            mainFile: {select: {id: true, filename: true, mimeType: true, title: true}},
            attachments: {
                select: {
                    id: true,
                    linkedVisualFileId: true,
                    file: {select: {id: true, filename: true, mimeType: true, title: true}},
                },
            },
        },
    })

    return NextResponse.json(card, {status: 201})
}
