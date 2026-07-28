import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"

/** GET — текущий pending-запрос заказчика */
export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== "CLIENT") return NextResponse.json(null)

  const pending = await prisma.requisiteChangeRequest.findFirst({
    where: { clientId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(pending)
}
