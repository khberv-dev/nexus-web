import {randomUUID} from "node:crypto";
import {NextRequest, NextResponse} from "next/server";
import {getServerSessionWithDevBypass} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";
import {buildS3Key, validateFile} from "@/lib/s3";

/** Регистрация строки StageFile + ключ S3; байты грузятся PUT на `/api/stages/.../files/.../upload` (без CORS на объектное хранилище). */

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const session = await getServerSessionWithDevBypass();
    if (!session?.user) return NextResponse.json({error: "Unauthorized"}, {status: 401});

    const {id} = await params;
    const {role, zitadelSub, id: userId} = session.user as {
        role: string;
        zitadelSub?: string | null;
        id: string;
    };
    if (role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403});

    const user = await prisma.user.findUnique({
        where: zitadelSub ? {zitadelId: zitadelSub} : {id: userId},
    });
    const stage = await prisma.projectStage.findUnique({where: {id}, include: {order: true}});
    if (!stage) return NextResponse.json({error: "Not found"}, {status: 404});
    if (stage.order.specialistId !== user?.id) return NextResponse.json({error: "Forbidden"}, {status: 403});
    if (stage.order.status !== "ACTIVE") {
        return NextResponse.json(
            {error: "Заказ ещё не активирован. Дождитесь подтверждения договора администратором."},
            {status: 409},
        );
    }

    const allowedStatuses = ["PENDING", "UPLOADED", "MOD_REVISION", "CLIENT_REVISION"];
    if (!allowedStatuses.includes(stage.status)) {
        const msg =
            stage.status === "BLOCKED"
                ? "Этап закрыт до принятия предыдущего"
                : `Cannot upload in status ${stage.status}`;
        return NextResponse.json({error: msg}, {status: 409});
    }

    const body = (await req.json()) as { filename?: string; size?: number };
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    if (!filename) return NextResponse.json({error: "filename required"}, {status: 400});
    validateFile(filename, body.size, {stageType: stage.type});

    const safeKeyFilename = `${Date.now()}-${randomUUID().slice(0, 8)}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const s3Key = buildS3Key(stage.order.id, stage.type, stage.version, safeKeyFilename);

    const file = await prisma.stageFile.create({data: {stageId: id, s3Key, filename}});
    return NextResponse.json({fileId: file.id});
}
