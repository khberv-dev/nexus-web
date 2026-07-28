import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionDbUser, getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { filterStageFilesVisibleToClient } from "@/lib/client-stage-file-visibility";

const NO_STORE_JSON = { "Cache-Control": "private, no-store, max-age=0" } as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await getSessionDbUser(user);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: { stages: { include: { files: true, reviews: true, act: true, extraPayments: true } }, payments: true },
  });
  if (!order || order.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "CLIENT" && order.clientId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (user.role === "SPECIALIST" && order.specialistId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Заказчик не должен видеть внутренние правки модератор↔дизайнер (отзывы модератора, файлы только для дизайнера).
  // Файлы сдачи — только после одобрения администратором (выпуск на CLIENT_REVIEW), см. StageReview MODERATOR APPROVED.
  if (user.role === "CLIENT") {
    const sanitized = {
      ...order,
      stages: order.stages.map((s) => ({
        ...s,
        reviews: s.reviews.filter((r) => r.reviewerRole !== "MODERATOR"),
        files: filterStageFilesVisibleToClient({
          status: s.status,
          files: s.files,
          reviews: s.reviews,
        }),
      })),
    };
    return NextResponse.json(sanitized, { headers: NO_STORE_JSON });
  }

  return NextResponse.json(order, { headers: NO_STORE_JSON });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await getSessionDbUser(user);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "CLIENT" && order.clientId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (user.role !== "CLIENT" && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT orders can be deleted" }, { status: 409 });

  const deletedAt = new Date();
  await prisma.order.update({ where: { id }, data: { deletedAt } });

  await audit(dbUser.id, "order_draft_soft_deleted", "Order", id, {
    deletedAt: { from: null, to: deletedAt.toISOString() },
  });

  return NextResponse.json({ ok: true });
}
