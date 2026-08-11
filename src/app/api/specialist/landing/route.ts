import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

// PATCH /api/specialist/landing  body: { landingWorkPos: "center 40%" }
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getOrCreateDbUser(user)
    const {landingWorkPos} = (await req.json()) as { landingWorkPos?: string }

    const updated = await prisma.specialistProfile.update({
        where: {userId: dbUser.id},
        data: {landingWorkPos: landingWorkPos ?? undefined},
    })

    return NextResponse.json({landingWorkPos: updated.landingWorkPos})
}
