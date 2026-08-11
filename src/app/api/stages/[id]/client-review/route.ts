import {NextRequest, NextResponse} from "next/server"
import {z} from "zod"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {transition} from "@/lib/stage-machine"
import {isStageUnlockedForClient, sortStages} from "@/lib/stage-order"
import {parseJsonBody} from "@/lib/validate"

const clientReviewSchema = z.object({
    action: z.enum(["clientApprove", "clientRevision"]),
    comment: z.string().optional(),
})

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params

    const parsed = await parseJsonBody(req, clientReviewSchema)
    if (!parsed.ok) return parsed.response
    const {action, comment} = parsed.data

    const dbUser = await prisma.user.findUnique({where: {email: user.email}})
    const stage = await prisma.projectStage.findUnique({
        where: {id},
        include: {order: {include: {specialist: true}}},
    })
    if (!stage || stage.order.clientId !== dbUser?.id) return NextResponse.json({error: "Forbidden"}, {status: 403})

    if (stage.status !== "CLIENT_REVIEW") {
        if (action === "clientApprove" && stage.status === "APPROVED") {
            return NextResponse.json({status: stage.status})
        }
        if (
            action === "clientRevision" &&
            (stage.status === "CLIENT_REVISION" || stage.status === "EXTRA_PAYMENT")
        ) {
            return NextResponse.json({status: stage.status})
        }
        return NextResponse.json({error: "Этап сейчас не ждёт вашего решения"}, {status: 409})
    }

    const pipeline = await prisma.projectStage.findMany({
        where: {orderId: stage.orderId},
        select: {type: true, status: true},
    })
    if (!isStageUnlockedForClient(sortStages(pipeline), stage.type)) {
        return NextResponse.json({error: "Сначала завершите предыдущие этапы"}, {status: 409})
    }

    try {
        const newStatus = await transition(id, action, "CLIENT", comment, dbUser?.id ?? null)
        return NextResponse.json({status: newStatus})
    } catch (err: unknown) {
        return NextResponse.json({error: (err as Error).message}, {status: 409})
    }
}
