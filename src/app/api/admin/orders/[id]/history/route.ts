import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const logs = await prisma.auditLog.findMany({
        where: {entity: "Order", entityId: id},
        orderBy: {createdAt: "desc"},
        include: {user: {select: {name: true, email: true, role: true}}},
        take: 50,
    })

    return NextResponse.json(logs)
}
