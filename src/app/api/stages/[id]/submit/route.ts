import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {Role} from "@prisma/client"
import {getSpecialistSubmitAction, transition} from "@/lib/stage-machine"

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const dbUser = await prisma.user.findUnique({where: {email: user.email}})
    const stage = await prisma.projectStage.findUnique({where: {id}, include: {order: true}})
    if (!stage || stage.order.specialistId !== dbUser?.id) return NextResponse.json({error: "Forbidden"}, {status: 403})
    if (stage.order.status !== "ACTIVE") {
        return NextResponse.json(
            {error: "Заказ ещё не активирован. Дождитесь подтверждения договора администратором."},
            {status: 409},
        )
    }

    const action = getSpecialistSubmitAction(stage.status)
    if (!action) return NextResponse.json({error: "Invalid status"}, {status: 400})

    try {
        const newStatus = await transition(id, action, Role.SPECIALIST, undefined, dbUser?.id ?? null)
        return NextResponse.json({status: newStatus})
    } catch (err: unknown) {
        return NextResponse.json({error: (err as Error).message}, {status: 409})
    }
}
