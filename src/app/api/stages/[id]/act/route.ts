import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {id: stageId} = await params;
    const {zitadelSub, role, id: userId} = session.user as {
        zitadelSub?: string | null;
        role: string;
        id: string;
    };
    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id: userId},
    });
    if (!user) return NextResponse.json({error: "User not found"}, {status: 404});

    const stage = await prisma.projectStage.findUnique({
        where: {id: stageId},
        include: {order: true, act: true},
    });
    if (!stage) return NextResponse.json({error: "Not found"}, {status: 404});

    if (role === "CLIENT" && stage.order.clientId !== user.id)
        return NextResponse.json({error: "Forbidden"}, {status: 403});
    if (role === "SPECIALIST" && stage.order.specialistId !== user.id)
        return NextResponse.json({error: "Forbidden"}, {status: 403});

    if (!stage.act) return NextResponse.json({error: "Act not found"}, {status: 404});

    return NextResponse.json(stage.act);
}
