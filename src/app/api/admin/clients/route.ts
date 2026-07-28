import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1"

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", ...(includeArchived ? {} : { archivedAt: null }) },
    include: {
      clientProfile: true,
      clientRequisiteChangeRequests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, oldData: true, newData: true },
      },
      orders: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, title: true, briefData: true, briefStep: true, briefHelpRequested: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    // Safety bound against unbounded loads (T3). Proper page/limit UI is Bosqich 3.
    take: 500,
  })

  return NextResponse.json(clients)
}
