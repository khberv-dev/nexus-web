import {NextResponse} from "next/server"
import {SignJWT} from "jose"
import {Role} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"

function tokenSecret(): Uint8Array | null {
    const raw = process.env.CHAT_WS_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
    return raw ? new TextEncoder().encode(raw) : null
}

export async function POST(_request: Request, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== Role.CLIENT && user.role !== Role.SPECIALIST && user.role !== Role.ADMIN) {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    const {id: orderId} = await params
    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {clientId: true, specialistId: true, deletedAt: true},
    })
    if (!order || order.deletedAt) return NextResponse.json({error: "Not found"}, {status: 404})
    const allowed = user.role === Role.ADMIN ||
        (user.role === Role.CLIENT && order.clientId === dbUser.id) ||
        (user.role === Role.SPECIALIST && order.specialistId === dbUser.id)
    if (!allowed) return NextResponse.json({error: "Forbidden"}, {status: 403})

    const secret = tokenSecret()
    if (!secret) return NextResponse.json({error: "Chat realtime is not configured"}, {status: 503})
    const token = await new SignJWT({orderId, role: user.role})
        .setProtectedHeader({alg: "HS256"})
        .setSubject(dbUser.id)
        .setIssuedAt()
        .setExpirationTime("2m")
        .sign(secret)

    return NextResponse.json({token}, {headers: {"Cache-Control": "no-store"}})
}
