import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"

/** PATCH /api/admin/files/[id]/audience — set file audience label */
export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const {audience} = await req.json() as { audience: "DESIGNER" | "CLIENT" | "SHARED" }
    if (!["DESIGNER", "CLIENT", "SHARED"].includes(audience)) {
        return NextResponse.json({error: "Invalid audience"}, {status: 400})
    }

    await prisma.stageFile.update({where: {id}, data: {audience}})
    return NextResponse.json({ok: true})
}
