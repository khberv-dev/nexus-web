import {NextRequest, NextResponse} from "next/server";
import {StageStatus} from "@prisma/client";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {putObject} from "@/lib/s3";

const UPLOAD_ALLOWED: StageStatus[] = [
    StageStatus.PENDING,
    StageStatus.UPLOADED,
    StageStatus.MOD_REVISION,
    StageStatus.CLIENT_REVISION,
];

/** PUT тело файла на наш backend → S3 (как `/api/files/[id]/upload`, без браузерного PUT на presigned URL и без CORS на бакет). */
export async function PUT(req: NextRequest, {params}: { params: Promise<{ id: string; fid: string }> }) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {id: stageId, fid} = await params;
    const {role, id: userId, zitadelSub} = session.user as { role: string; id: string; zitadelSub?: string | null };
    if (role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id: userId},
    });

    const stageFile = await prisma.stageFile.findUnique({
        where: {id: fid},
        include: {stage: {include: {order: {select: {specialistId: true, status: true}}}}},
    });

    if (!stageFile || stageFile.stageId !== stageId) {
        return NextResponse.json({error: "Not found"}, {status: 404});
    }
    if (stageFile.stage.order.specialistId !== user?.id) {
        return NextResponse.json({error: "Forbidden"}, {status: 403});
    }
    if (stageFile.stage.order.status !== "ACTIVE") {
        return NextResponse.json(
            {error: "Заказ ещё не активирован. Дождитесь подтверждения договора администратором."},
            {status: 409},
        );
    }
    if (!UPLOAD_ALLOWED.includes(stageFile.stage.status)) {
        return NextResponse.json(
            {
                error:
                    stageFile.stage.status === StageStatus.BLOCKED
                        ? "Этап закрыт до принятия предыдущего"
                        : `Cannot upload in status ${stageFile.stage.status}`,
            },
            {status: 409},
        );
    }

    const body = Buffer.from(await req.arrayBuffer());
    if (!body.length) return NextResponse.json({error: "Empty file body"}, {status: 400});

    const contentType = req.headers.get("content-type") ?? "application/octet-stream";
    await putObject(stageFile.s3Key, body, contentType);

    return NextResponse.json({ok: true});
}
