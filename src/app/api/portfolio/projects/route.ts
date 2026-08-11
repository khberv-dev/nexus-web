import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

export async function GET() {
    try {
        const user = await getSessionUser()
        if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

        const dbUser = await getOrCreateDbUser(user)
        const projects = await prisma.portfolioProject.findMany({
            where: {userId: dbUser.id},
            orderBy: {createdAt: "desc"},
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: {select: {cards: true}},
            },
        })

        return NextResponse.json(projects)
    } catch (e) {
        console.error("[portfolio/projects GET]", e)
        const message = e instanceof Error ? e.message : "Internal server error"
        return NextResponse.json({error: message}, {status: 500})
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser()
        if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

        const dbUser = await getOrCreateDbUser(user)
        const body = (await req.json()) as { name?: string }
        const name = body.name?.trim()
        if (!name) return NextResponse.json({error: "Project name is required"}, {status: 400})

        const project = await prisma.portfolioProject.create({
            data: {userId: dbUser.id, name},
            select: {id: true, name: true, createdAt: true, _count: {select: {cards: true}}},
        })

        return NextResponse.json(project, {status: 201})
    } catch (e) {
        console.error("[portfolio/projects POST]", e)
        const message = e instanceof Error ? e.message : "Internal server error"
        return NextResponse.json({error: message}, {status: 500})
    }
}
