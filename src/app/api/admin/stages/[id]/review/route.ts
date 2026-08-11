import {NextRequest, NextResponse} from "next/server"
import {z} from "zod"
import {getSessionUser} from "@/lib/session"
import {transition} from "@/lib/stage-machine"
import {sendEmail} from "@/lib/email"
import {prisma} from "@/lib/db/prisma"
import {parseJsonBody} from "@/lib/validate"

const reviewSchema = z.object({
    action: z.enum(["modApprove", "modRevision"]),
    comment: z.string().optional(),
})

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const parsed = await parseJsonBody(req, reviewSchema)
    if (!parsed.ok) return parsed.response
    const {action, comment} = parsed.data

    const stage = await prisma.projectStage.findUnique({
        where: {id},
        include: {order: {include: {client: true, specialist: true}}},
    })
    if (!stage) return NextResponse.json({error: "Not found"}, {status: 404})

    try {
        const newStatus = await transition(id, action, "ADMIN", comment, user.id)

        if (action === "modApprove" && stage.order.client.email) {
            void sendEmail("stage_mod_approved", stage.order.client.email, {stageId: id, orderId: stage.orderId})
        }
        if (action === "modRevision" && stage.order.specialist?.email) {
            void sendEmail("stage_revision", stage.order.specialist.email, {stageId: id, orderId: stage.orderId})
        }

        return NextResponse.json({status: newStatus})
    } catch (err: unknown) {
        return NextResponse.json({error: (err as Error).message}, {status: 409})
    }
}
