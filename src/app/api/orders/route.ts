import {NextRequest, NextResponse} from "next/server"
import {StageStatus} from "@prisma/client"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {STAGE_ORDER} from "@/lib/stage-constants"

export async function GET() {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    const where = user.role === "ADMIN" ? {deletedAt: null} : {clientId: dbUser.id, deletedAt: null}

    const orders = await prisma.order.findMany({
        where,
        orderBy: {createdAt: "desc"},
        include: {
            client: {select: {email: true, name: true}},
            specialist: {select: {email: true, name: true}},
        },
    })

    return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    const body = await req.json() as Record<string, string>

    const order = await prisma.order.create({
        data: {
            clientId: dbUser.id,
            status: "DRAFT",
            briefData: Object.keys(body).length > 0 ? body : undefined,
            stages: {
                create: STAGE_ORDER.map((type, i) => ({
                    type,
                    status: i === 0 ? StageStatus.PENDING : StageStatus.BLOCKED,
                })),
            },
        },
    })

    return NextResponse.json(order, {status: 201})
}
