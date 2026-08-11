import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

export async function GET() {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const items = await prisma.notification.findMany({
        where: {userId: user.id},
        orderBy: {createdAt: "desc"},
        take: 50,
    })
    const unread = await prisma.notification.count({where: {userId: user.id, readAt: null}})

    return NextResponse.json({items, unread})
}

export async function PATCH(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id, all} = await req.json()

    if (all) {
        await prisma.notification.updateMany({where: {userId: user.id, readAt: null}, data: {readAt: new Date()}})
    } else if (id) {
        await prisma.notification.updateMany({where: {id, userId: user.id, readAt: null}, data: {readAt: new Date()}})
    }

    return NextResponse.json({ok: true})
}
