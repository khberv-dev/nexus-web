import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const entity = req.nextUrl.searchParams.get("entity")
    const entityId = req.nextUrl.searchParams.get("entityId")
    if (!entity || !entityId) return NextResponse.json({error: "entity and entityId required"}, {status: 400})

    // createdAt хранится с точностью до миллисекунды, а одно действие админа пишет
    // несколько записей подряд — без добавочной сортировки по id такие строки
    // возвращаются в произвольном порядке и лента «прыгает». cuid монотонен по времени,
    // поэтому id desc — корректный доводчик «новое сверху» (так же сделано в
    // src/app/api/orders/[id]/history/route.ts).
    const logs = await prisma.auditLog.findMany({
        where: {entity, entityId},
        orderBy: [{createdAt: "desc"}, {id: "desc"}],
        include: {user: {select: {name: true, email: true, role: true}}},
        take: 30,
    })

    return NextResponse.json(logs)
}
