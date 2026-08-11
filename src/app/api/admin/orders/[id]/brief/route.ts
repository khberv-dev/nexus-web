import {NextRequest, NextResponse} from "next/server"
import {z} from "zod"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {audit, diff} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {parseJsonBody} from "@/lib/validate"

// Free-form brief fields (arbitrary keys) + optional `action`. Lenient object;
// the handler itself keeps only string values (sliced to 2000). Rejects non-objects.
const briefSchema = z.record(z.string(), z.unknown())

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const parsed = await parseJsonBody(req, briefSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data as Record<string, string | undefined>

    // Special action: close "help requested" flag
    if (body.action === "resolve_help") {
        const order = await prisma.order.findUnique({where: {id}, select: {clientId: true, deletedAt: true}})
        if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
        await prisma.order.update({where: {id}, data: {briefHelpRequested: false}})
        const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
        await audit(dbUser?.id ?? null, "brief_help_resolved", "Order", id, {})
        void notify(order.clientId, "brief_help_resolved", "Менеджер помог с брифом", "Запрос на помощь закрыт. Продолжайте заполнение брифа.", `/orders/${id}`)
        return NextResponse.json({ok: true})
    }

    const briefData: Record<string, string> = {}
    for (const [k, v] of Object.entries(body)) {
        if (k !== "action" && typeof v === "string") briefData[k] = v.slice(0, 2000)
    }

    const order = await prisma.order.findUnique({where: {id}, select: {briefData: true, deletedAt: true}})
    if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
    const before = (order?.briefData as Record<string, string>) ?? {}
    const merged = {...before, ...briefData}
    const changes = diff(before, merged)

    await prisma.order.update({where: {id}, data: {briefData: merged}})

    const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
    if (changes) await audit(dbUser?.id ?? null, "brief_edited", "Order", id, changes)

    return NextResponse.json({ok: true})
}
