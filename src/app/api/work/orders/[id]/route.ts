import {NextResponse} from "next/server";
import {prisma} from "@/lib/db/prisma";
import {getSessionUser} from "@/lib/session";
import {sortStages} from "@/lib/stage-order";

export async function GET(_req: Request, {params}: { params: Promise<{ id: string }> }) {
    const {id} = await params;
    const session = await getSessionUser();
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const user = await prisma.user.findUnique({where: {id: session.id}});
    if (!user) return NextResponse.json({error: "Not found"}, {status: 404});

    const order = await prisma.order.findFirst({
        where: {id, specialistId: user.id, deletedAt: null},
        include: {
            client: {select: {name: true, email: true}},
            stages: {
                orderBy: {type: "asc"},
                include: {
                    files: {orderBy: {uploadedAt: "desc"}},
                    reviews: {orderBy: {createdAt: "desc"}, take: 1},
                },
            },
            payments: {orderBy: {createdAt: "desc"}, take: 1},
        },
    });

    if (!order) return NextResponse.json({error: "Not found"}, {status: 404});
    return NextResponse.json({...order, stages: sortStages(order.stages)});
}
