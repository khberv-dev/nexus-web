import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"

// GET /api/files/[id]/url — presigned download URL
export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id} = await params
    const dbUser = await getOrCreateDbUser(user)
    const file = await prisma.userFile.findUnique({where: {id}})

    if (!file || file.userId !== dbUser.id) return NextResponse.json({error: "Not found"}, {status: 404})

    const {url} = await getDownloadUrl(file.s3Key)
    return NextResponse.json({url})
}
