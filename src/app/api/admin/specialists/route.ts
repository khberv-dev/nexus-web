import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {ensureDevBypassDemoOrders} from "@/lib/dev-demo-data"
import {getSessionUser} from "@/lib/session"

export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1"

    await ensureDevBypassDemoOrders()

    const specialists = await prisma.user.findMany({
        where: {role: "SPECIALIST", ...(includeArchived ? {} : {archivedAt: null})},
        include: {
            specialistProfile: {include: {steps: true}},
            files: {
                where: {
                    category: {in: ["PORTFOLIO", "AVATAR", "DOCUMENT", "PORTRAIT", "LANDING_WORK", "INTRO_VIDEO"]},
                },
                orderBy: {createdAt: "desc"},
            },
        },
        orderBy: {createdAt: "desc"},
    })

    return NextResponse.json(specialists)
}
