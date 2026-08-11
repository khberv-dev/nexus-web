import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const file = await prisma.userFile.findUnique({where: {id}})
    if (!file) return NextResponse.json({error: "Not found"}, {status: 404})

    const {url} = await getDownloadUrl(file.s3Key)
    return NextResponse.json({url})
}
