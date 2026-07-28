import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/session";
import { sortStages } from "@/lib/stage-order";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json([]);

  const orders = await prisma.order.findMany({
    where: { specialistId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, email: true } },
      stages: {
        orderBy: { type: "asc" },
        include: { files: { orderBy: { uploadedAt: "desc" } } },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json(
    orders.map((o) => ({
      ...o,
      stages: sortStages(o.stages),
    }))
  );
}
