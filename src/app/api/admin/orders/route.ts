import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {ensureDevBypassDemoOrders} from "@/lib/dev-demo-data"
import {getSessionUser} from "@/lib/session"
import {formatUserName} from "@/lib/user-name"

export async function GET() {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    await ensureDevBypassDemoOrders()

    const orders = await prisma.order.findMany({
        where: {deletedAt: null},
        include: {
            client: {select: {id: true, email: true, firstName: true, lastName: true}},
            specialist: {select: {id: true, email: true, firstName: true, lastName: true}},
            briefVideoFile: {select: {id: true, s3Key: true, filename: true, mimeType: true, createdAt: true}},
            stages: {
                include: {
                    files: {orderBy: {uploadedAt: "desc"}},
                    reviews: {orderBy: {createdAt: "desc"}},
                    payment: {select: {id: true, amount: true, status: true}},
                    extraPayments: {select: {id: true, amount: true, status: true, reason: true}},
                    act: {
                        select: {
                            id: true, signedAt: true, signedById: true, status: true,
                            generatedAt: true, specialistActS3Key: true, clientActS3Key: true,
                            specialistUploadedAt: true, adminApprovedAt: true,
                            clientSignedAt: true, adminConfirmedAt: true,
                        }
                    },
                },
            },
            payments: true,
            contracts: {orderBy: {createdAt: "desc"}},
        },
        orderBy: {createdAt: "desc"},
        // Safety bound against unbounded loads (T3). Proper page/limit UI is Bosqich 3.
        take: 500,
    })

    // Resolve display names
    const result = orders.map(o => {
        return {
            ...o,
            client: {id: o.client.id, email: o.client.email, name: formatUserName(o.client) || null},
            specialist: o.specialist ? {
                id: o.specialist.id,
                email: o.specialist.email,
                name: formatUserName(o.specialist) || null
            } : null,
        }
    })

    return NextResponse.json(result)
}
