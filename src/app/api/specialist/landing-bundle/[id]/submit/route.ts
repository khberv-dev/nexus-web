import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {notify} from "@/lib/notifications"
import {validateLandingBundleFiles} from "@/lib/landing/bundle-input"

// POST — отправить сборку на модерацию
export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    const {id} = await params
    const dbUser = await getOrCreateDbUser(user)
    if (dbUser.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const bundle = await prisma.landingBundle.findUnique({where: {id}, include: {items: true}})
    if (!bundle || bundle.userId !== dbUser.id) return NextResponse.json({error: "Not found"}, {status: 404})
    if (bundle.status !== "DRAFT" && bundle.status !== "REJECTED") {
        return NextResponse.json({error: "Нельзя отправить эту сборку"}, {status: 400})
    }
    if (!bundle.portraitFileId || !bundle.workFileId) {
        return NextResponse.json({error: "Портрет и фото интерьера обязательны"}, {status: 400})
    }
    try {
        await validateLandingBundleFiles(dbUser.id, {
            portraitFileId: bundle.portraitFileId,
            workFileId: bundle.workFileId,
            videoFileId: bundle.videoFileId,
            portfolioFileIds: bundle.items.map((item) => item.fileId),
        })
    } catch (error) {
        return NextResponse.json({error: (error as Error).message}, {status: 400})
    }

    const updated = await prisma.landingBundle.update({
        where: {id},
        data: {status: "PENDING_REVIEW"},
        include: {items: {orderBy: {position: "asc"}}},
    })

    // Notify all admins
    const admins = await prisma.user.findMany({where: {role: "ADMIN"}, select: {id: true}})
    const specName = dbUser.name ?? dbUser.email ?? "Специалист"
    for (const admin of admins) {
        await notify(admin.id, "landing_bundle_submitted", "Новая сборка на модерацию", `${specName} отправил сборку для лендинга`, "/admin/landing")
    }

    return NextResponse.json(updated)
}
