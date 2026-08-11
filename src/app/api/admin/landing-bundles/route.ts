import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {LandingBundleStatus} from "@prisma/client"

// GET — список сборок на модерацию (+ все для обзора)
export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    const dbUser = await getOrCreateDbUser(user)
    if (dbUser.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const status = req.nextUrl.searchParams.get("status")
    const resolvedStatus = status && Object.values(LandingBundleStatus).includes(status as LandingBundleStatus)
        ? (status as LandingBundleStatus)
        : null

    const bundles = await prisma.landingBundle.findMany({
        where: resolvedStatus ? {status: resolvedStatus} : undefined,
        include: {
            user: {select: {id: true, name: true, email: true}},
            items: {orderBy: {position: "asc"}},
        },
        orderBy: {updatedAt: "desc"},
    })
    return NextResponse.json(bundles)
}
