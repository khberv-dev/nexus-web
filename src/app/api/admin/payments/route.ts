import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"

export async function GET() {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const payments = await prisma.payment.findMany({
        include: {
            order: {
                select: {
                    id: true,
                    title: true,
                    status: true,
                    client: {select: {email: true, name: true}},
                    specialist: {select: {email: true, name: true}},
                },
            },
        },
        orderBy: {createdAt: "desc"},
        // Safety bound against unbounded loads (T3). Proper page/limit UI is Bosqich 3.
        take: 500,
    })

    return NextResponse.json(payments)
}
