import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"

/** POST /api/admin/users/[id]/revoke-session
 *  Инвалидирует текущую сессию пользователя: инкрементирует sessionVersion.
 *  При следующем обращении к API пользователь получит 401 и будет перенаправлен на логин.
 *  Максимальное окно действия старого токена — до истечения TTL куки (maxAge 1 час).
 */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const {id} = await params

    const target = await prisma.user.findUnique({
        where: {id},
        select: {id: true, role: true, archivedAt: true, sessionVersion: true},
    })
    if (!target) return NextResponse.json({error: "User not found"}, {status: 404})

    const updated = await prisma.user.update({
        where: {id},
        data: {sessionVersion: {increment: 1}},
        select: {id: true, sessionVersion: true},
    })

    await audit(admin.id, "session_revoked", "User", id, {
        sessionVersion: {from: target.sessionVersion, to: updated.sessionVersion},
    })

    return NextResponse.json({ok: true, sessionVersion: updated.sessionVersion})
}
