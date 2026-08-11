import {NextResponse} from "next/server";
import {StageStatus} from "@prisma/client";
import {prisma} from "@/lib/db/prisma";
import {getSessionUser} from "@/lib/session";

const UPLOAD_ALLOWED: StageStatus[] = [
    StageStatus.PENDING,
    StageStatus.UPLOADED,
    StageStatus.MOD_REVISION,
    StageStatus.CLIENT_REVISION,
];

/** После прямой загрузки в S3 (presigned PUT) обновляем статус этапа — без multipart через Next.js. */
export async function POST(_req: Request, {params}: { params: Promise<{ id: string }> }) {
    const {id: stageId} = await params;
    const session = await getSessionUser();
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    if (session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const user = await prisma.user.findUnique({where: {id: session.id}});
    const stage = await prisma.projectStage.findUnique({
        where: {id: stageId},
        include: {order: {select: {specialistId: true, status: true}}},
    });

    if (!stage || !user || stage.order.specialistId !== user.id) {
        return NextResponse.json({error: "Forbidden"}, {status: 403});
    }
    if (stage.order.status !== "ACTIVE") {
        return NextResponse.json(
            {error: "Заказ ещё не активирован. Дождитесь подтверждения договора администратором."},
            {status: 409},
        );
    }

    if (!UPLOAD_ALLOWED.includes(stage.status)) {
        return NextResponse.json(
            {
                error:
                    stage.status === StageStatus.BLOCKED
                        ? "Этап закрыт до принятия предыдущего"
                        : `Cannot finalize upload in status ${stage.status}`,
            },
            {status: 409},
        );
    }

    const nextStatus = stage.status === StageStatus.PENDING ? StageStatus.UPLOADED : stage.status;
    await prisma.projectStage.update({where: {id: stageId}, data: {status: nextStatus}});

    return NextResponse.json({ok: true, status: nextStatus});
}
