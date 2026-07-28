import { NextRequest, NextResponse } from "next/server";
import { StageStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { putObject, validateFile } from "@/lib/s3";
import { getSessionUser } from "@/lib/session";

const UPLOAD_ALLOWED: StageStatus[] = [
  StageStatus.PENDING,
  StageStatus.UPLOADED,
  StageStatus.MOD_REVISION,
  StageStatus.CLIENT_REVISION,
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: stageId } = await params;
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    include: { order: { select: { id: true, specialistId: true, status: true } } },
  });

  if (!stage || !user || stage.order.specialistId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (stage.order.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Заказ ещё не активирован. Дождитесь подтверждения договора администратором." },
      { status: 409 },
    );
  }

  if (!UPLOAD_ALLOWED.includes(stage.status)) {
    return NextResponse.json(
      { error: stage.status === StageStatus.BLOCKED ? "Этап закрыт до принятия предыдущего" : `Cannot upload in status ${stage.status}` },
      { status: 409 },
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const video = formData.get("video") as File | null;
  if (!files.length && !video) return NextResponse.json({ error: "No files" }, { status: 400 });

  const saved = await Promise.all(
    files.map(async (file) => {
      validateFile(file.name, file.size, { stageType: stage.type });
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const s3Key = `orders/${stage.order.id}/stages/${stage.type}/${stage.version}/${safeName}`;
      await putObject(s3Key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
      return prisma.stageFile.create({ data: { stageId, s3Key, filename: file.name } });
    })
  );

  // Upload video explanation if provided
  if (video) {
    validateFile(video.name, video.size, { stageType: stage.type });
    const safeName = `${Date.now()}-video-${video.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const s3Key = `orders/${stage.order.id}/stages/${stage.type}/${stage.version}/${safeName}`;
    await putObject(s3Key, Buffer.from(await video.arrayBuffer()), video.type || "video/mp4");
    await prisma.stageFile.create({ data: { stageId, s3Key, filename: `🎬 ${video.name}` } });
  }

  // Только первый залив переводит PENDING → UPLOADED. При доработках статус не затирать:
  // MOD_REVISION / CLIENT_REVISION должны оставаться такими, иначе submit выберет «submit»
  // вместо resubmitMod/resubmitClient → конфликт с машиной состояний (409).
  const nextStatus =
    stage.status === StageStatus.PENDING ? StageStatus.UPLOADED : stage.status;
  await prisma.projectStage.update({ where: { id: stageId }, data: { status: nextStatus } });

  return NextResponse.json({ ok: true, files: saved });
}
