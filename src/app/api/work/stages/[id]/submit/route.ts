import {NextRequest, NextResponse} from "next/server";
import {Role} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {getSessionUser} from "@/lib/session";
import {getSpecialistSubmitAction, transition} from "@/lib/stage-machine";

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const {id: stageId} = await params;
    const session = await getSessionUser();
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    if (session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const user = await prisma.user.findUnique({where: {id: session.id}});
    const stage = await prisma.projectStage.findUnique({
        where: {id: stageId},
        include: {order: {select: {specialistId: true}}},
    });

    if (!stage || !user || stage.order.specialistId !== user.id) {
        return NextResponse.json({error: "Forbidden"}, {status: 403});
    }

    const action = getSpecialistSubmitAction(stage.status);
    if (!action) return NextResponse.json({error: "Invalid status"}, {status: 400});

    try {
        const newStatus = await transition(stageId, action, Role.SPECIALIST, undefined, user.id);
        return NextResponse.json({ok: true, status: newStatus});
    } catch (err: unknown) {
        return NextResponse.json({error: (err as Error).message}, {status: 409});
    }
}
