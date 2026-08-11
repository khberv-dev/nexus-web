import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {notify} from "@/lib/notifications"

// POST — approve / reject сборку
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    const dbUser = await getOrCreateDbUser(user)
    if (dbUser.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const {action, reason} = (await req.json()) as { action: "approve" | "reject"; reason?: string }

    const bundle = await prisma.landingBundle.findUnique({where: {id}})
    if (!bundle || bundle.status !== "PENDING_REVIEW") {
        return NextResponse.json({error: "Сборка не найдена или не на модерации"}, {status: 404})
    }

    if (action === "approve") {
        await prisma.$transaction(async (tx) => {
            await tx.landingBundle.updateMany({
                where: {userId: bundle.userId, status: "APPROVED"},
                data: {status: "DRAFT"},
            })
            await tx.landingBundle.update({
                where: {id},
                data: {status: "APPROVED", reviewedBy: dbUser.id, reviewedAt: new Date()},
            })
            await tx.specialistProfile.update({
                where: {userId: bundle.userId},
                data: {featuredOnLanding: true, landingWorkPos: bundle.workPos},
            })
        })
        await notify(bundle.userId, "landing_bundle_approved", "Сборка одобрена", "Ваш профиль теперь на главной странице", "/work/community?tab=landing")
    } else {
        if (!reason?.trim()) return NextResponse.json({error: "Укажите причину отказа"}, {status: 400})
        await prisma.landingBundle.update({
            where: {id},
            data: {status: "REJECTED", rejectReason: reason.trim(), reviewedBy: dbUser.id, reviewedAt: new Date()},
        })
        await notify(bundle.userId, "landing_bundle_rejected", "Сборка отклонена", reason.trim(), "/work/community?tab=landing")
    }

    return NextResponse.json({ok: true})
}
