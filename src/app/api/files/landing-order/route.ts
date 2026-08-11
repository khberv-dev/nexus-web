import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"

// PUT /api/files/landing-order  body: { fileIds: [id1, id2, id3] }
// Sets landingOrder 0,1,2 for given files, clears landingOrder on all other PORTFOLIO files
export async function PUT(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const dbUser = await getOrCreateDbUser(user)
    const {fileIds} = (await req.json()) as { fileIds: string[] }

    if (!Array.isArray(fileIds) || fileIds.length > 3)
        return NextResponse.json({error: "Max 3 files"}, {status: 400})

    // Clear all existing landing orders for this user's portfolio files
    await prisma.userFile.updateMany({
        where: {userId: dbUser.id, category: "PORTFOLIO", landingOrder: {not: null}},
        data: {landingOrder: null},
    })

    // Set order for selected files
    await Promise.all(
        fileIds.map((id, i) =>
            prisma.userFile.updateMany({
                where: {id, userId: dbUser.id, category: "PORTFOLIO"},
                data: {landingOrder: i},
            }),
        ),
    )

    return NextResponse.json({ok: true})
}
