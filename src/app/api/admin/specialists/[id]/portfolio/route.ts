import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"

/** Дерево портфолио в ЛК: проекты → работы → материалы (+ материалы к проекту). */
export async function GET(_req: Request, {params}: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const specialist = await prisma.user.findUnique({
        where: {id},
        select: {id: true, role: true},
    })
    if (!specialist || specialist.role !== "SPECIALIST") {
        return NextResponse.json({error: "Not found"}, {status: 404})
    }

    const projects = await prisma.portfolioProject.findMany({
        where: {userId: id},
        orderBy: {createdAt: "asc"},
        select: {
            id: true,
            name: true,
            attachments: {
                orderBy: {createdAt: "asc"},
                select: {
                    id: true,
                    file: {select: {id: true, filename: true, mimeType: true, category: true}},
                },
            },
            cards: {
                orderBy: {createdAt: "asc"},
                select: {
                    id: true,
                    title: true,
                    mainFile: {select: {id: true, filename: true, mimeType: true, category: true}},
                    attachments: {
                        orderBy: {createdAt: "asc"},
                        select: {
                            id: true,
                            linkedVisualFileId: true,
                            file: {select: {id: true, filename: true, mimeType: true, category: true}},
                        },
                    },
                },
            },
        },
    })

    return NextResponse.json({projects})
}
