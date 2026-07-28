import { NextResponse } from "next/server"
import { getSessionUser, getSessionDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { ClientFrameworkContractStatus, OrderStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { isFrameworkContractEffectiveSigned } from "@/lib/framework-contract"
import { notify } from "@/lib/notifications"

function briefHasContent(briefData: unknown): boolean {
  if (!briefData || typeof briefData !== "object" || Array.isArray(briefData)) return false
  return Object.values(briefData as Record<string, unknown>).some(v => v != null && String(v).trim() !== "")
}

/** Админ фиксирует подписание договора оказания услуг; подходящие заказы переводятся в ACTIVE для назначения специалиста. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const dbAdmin = await getSessionDbUser(user)
  const { id: clientUserId } = await params

  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: "CLIENT" },
    include: { clientProfile: true },
  })
  if (!client?.clientProfile) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const profile = client.clientProfile
  if (!profile.frameworkContractS3Key?.trim()) {
    return NextResponse.json(
      { error: "Сначала загрузите PDF договора оказания услуг в карточке заказчика." },
      { status: 400 },
    )
  }

  if (isFrameworkContractEffectiveSigned(profile.frameworkContractStatus)) {
    return NextResponse.json({ ok: true, alreadySigned: true, promotedOrderIds: [] })
  }

  const orders = await prisma.order.findMany({
    where: {
      clientId: clientUserId,
      deletedAt: null,
      status: { in: [OrderStatus.DRAFT, OrderStatus.BRIEFING, OrderStatus.BRIEF_REVIEW] },
    },
    select: { id: true, status: true, briefData: true },
  })

  const toActive = orders.filter(o => {
    if (o.status === OrderStatus.DRAFT) return briefHasContent(o.briefData)
    return true
  })

  await prisma.$transaction(async tx => {
    await tx.clientProfile.update({
      where: { id: profile.id },
      data: { frameworkContractStatus: ClientFrameworkContractStatus.SIGNED_BY_ADMIN },
    })
    for (const o of toActive) {
      await tx.order.update({
        where: { id: o.id },
        data: { status: OrderStatus.ACTIVE },
      })
    }
  })

  for (const o of toActive) {
    await audit(dbAdmin?.id ?? null, "framework_contract_admin_signed", "Order", o.id, {
      status: { from: o.status, to: "ACTIVE" },
    })
  }

  await audit(dbAdmin?.id ?? null, "framework_contract_admin_signed", "ClientProfile", profile.id, {
    frameworkContractStatus: { to: "SIGNED_BY_ADMIN" },
    ordersPromoted: { to: toActive.length },
  })

  void notify(clientUserId, "framework_contract_signed", "Договор подтвержден", "Администратор подтвердил договор оказания услуг. Можно приступать к работе!", "/orders")

  return NextResponse.json({
    ok: true,
    promotedOrderIds: toActive.map(o => o.id),
    promotedCount: toActive.length,
  })
}
