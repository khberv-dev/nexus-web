import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"

const DEMO_EMAILS = ["demo-client@nexuspro.ru", "demo-specialist@nexuspro.ru"]

export async function POST(req: NextRequest) {
    const {key} = (await req.json().catch(() => ({}))) as { key?: string }
    if (!key || key !== process.env.DEMO_ACCESS_KEY) {
        return NextResponse.json({error: "Invalid key"}, {status: 403})
    }

    const users = await prisma.user.findMany({
        where: {email: {in: DEMO_EMAILS}},
        select: {id: true, email: true},
    })

    let deleted = 0
    for (const u of users) {
        const id = u.id
        // Delete all related data in correct order
        await prisma.$transaction([
            prisma.onboardingStep.deleteMany({where: {profile: {userId: id}}}),
            prisma.specialistProfile.deleteMany({where: {userId: id}}),
            prisma.clientProfile.deleteMany({where: {userId: id}}),
            prisma.landingBundleItem.deleteMany({where: {bundle: {userId: id}}}),
            prisma.landingBundle.deleteMany({where: {userId: id}}),
            prisma.portfolioCardAttachment.deleteMany({where: {file: {userId: id}}}),
            prisma.portfolioProjectAttachment.deleteMany({where: {file: {userId: id}}}),
            prisma.portfolioCard.deleteMany({where: {project: {userId: id}}}),
            prisma.portfolioProject.deleteMany({where: {userId: id}}),
            prisma.userFile.deleteMany({where: {userId: id}}),
            prisma.stageAct.updateMany({where: {signedById: id}, data: {signedById: null}}),
            prisma.notification.deleteMany({where: {userId: id}}),
            prisma.auditLog.deleteMany({where: {userId: id}}),
            prisma.requisiteChangeRequest.deleteMany({where: {specialistId: id}}),
            prisma.account.deleteMany({where: {userId: id}}),
            prisma.session.deleteMany({where: {userId: id}}),
        ])
        // Delete orders where user is client (cascade handles stages, payments, etc.)
        await prisma.order.deleteMany({where: {clientId: id}})
        // Nullify specialist assignment on other orders
        await prisma.order.updateMany({where: {specialistId: id}, data: {specialistId: null}})
        // Delete user
        await prisma.user.delete({where: {id}})
        deleted++
    }

    // Also clean up pending signups for demo emails
    await prisma.pendingSignup.deleteMany({where: {email: {in: DEMO_EMAILS}}})

    return NextResponse.json({ok: true, deleted})
}
