import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const entity = req.nextUrl.searchParams.get("entity")
    const search = req.nextUrl.searchParams.get("search")
    const limitStr = req.nextUrl.searchParams.get("limit")
    const limit = Math.min(parseInt(limitStr || "50"), 500)

    const where: Record<string, unknown> = {}

    if (entity) {
        where.entity = entity
    }

    if (search) {
        where.OR = [
            {entityId: {contains: search, mode: "insensitive"}},
            {user: {email: {contains: search, mode: "insensitive"}}},
            {user: {name: {contains: search, mode: "insensitive"}}},
        ]
    }

    try {
        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: {createdAt: "desc"},
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            take: limit,
        })

        return NextResponse.json(logs)
    } catch (err) {
        console.error("[audit/all] Error:", err)
        return NextResponse.json(
            {error: "Failed to fetch audit logs"},
            {status: 500}
        )
    }
}
