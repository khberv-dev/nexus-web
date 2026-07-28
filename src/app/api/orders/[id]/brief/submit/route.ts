import { NextRequest, NextResponse } from "next/server"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { OrderStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const dbUser = await getSessionDbUser(user)
  const order = await prisma.order.findUnique({ where: { id } })

  if (!order || order.deletedAt || order.clientId !== dbUser?.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (order.status !== OrderStatus.DRAFT) return NextResponse.json({ error: "Only DRAFT orders can be submitted" }, { status: 409 })

  const brief = order.briefData as Record<string, string> | null
  if (!brief || !Object.values(brief).some(v => v)) {
    return NextResponse.json({ error: "Brief is empty" }, { status: 422 })
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.BRIEFING },
  })

  await audit(dbUser?.id ?? null, "brief_submitted", "Order", id, { status: { from: "DRAFT", to: "BRIEFING" } })
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } })
  const shortId = id.slice(-6).toUpperCase()
  for (const admin of admins) {
    if (admin.email) void sendEmail("new_order", admin.email, { orderId: id, status: "BRIEFING" })
    void notify(admin.id, "new_brief", "Новый бриф", `Заказчик отправил бриф #${shortId}`, `/admin/orders`)
  }

  return NextResponse.json({ status: updated.status })
}
