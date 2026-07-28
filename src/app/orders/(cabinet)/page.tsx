import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { getDownloadUrl } from "@/lib/s3"
import { isClientCabinetProfileComplete } from "@/lib/client-requisites-validation"
import { normalizeClientCabinetFormData } from "@/lib/client-profile-form-normalize"
import ClientCabinetPage from "@/components/Client/ClientCabinetPage"
import type { ClientContract } from "@/components/Client/client-cabinet/types"
import { sortStages } from "@/lib/stage-order"

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role === "SPECIALIST") redirect("/work")
  if (user.role === "ADMIN") redirect("/admin")

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { clientProfile: true },
  })
  if (!dbUser) redirect("/login")

  if (!isClientCabinetProfileComplete(dbUser.clientProfile?.formData)) {
    const pending = await prisma.requisiteChangeRequest.findFirst({
      where: { clientId: dbUser.id, status: "PENDING" },
      select: { id: true },
    })
    if (!pending) redirect("/orders/onboarding")
  }

  const formDataForClient = normalizeClientCabinetFormData(dbUser.clientProfile?.formData, dbUser)
  const displayName = dbUser.name?.trim() || user.name?.trim() || user.email

  // If requisites are pending approval — show the latest requested requisites in Settings UI.
  const pendingReq = await prisma.requisiteChangeRequest.findFirst({
    where: { clientId: dbUser.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { newData: true },
  })
  if (pendingReq?.newData && typeof pendingReq.newData === "object" && !Array.isArray(pendingReq.newData)) {
    for (const [k, v] of Object.entries(pendingReq.newData as Record<string, unknown>)) {
      if (typeof v === "string") formDataForClient[k] = v
    }
    formDataForClient.requisitesPending = "true"
  }

  const fw = dbUser.clientProfile
  const frameworkContract = {
    status: fw?.frameworkContractStatus ?? "NONE",
    number: fw?.frameworkContractNumber ?? null,
    hasFile: Boolean(fw?.frameworkContractS3Key),
  }

  const orders = await prisma.order.findMany({
    where: { clientId: dbUser.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      specialist: {
        select: {
          id: true,
          name: true,
          email: true,
          specialistProfile: { select: { formData: true } },
          files: { where: { category: "AVATAR" }, orderBy: { createdAt: "desc" }, take: 1, select: { s3Key: true } },
        },
      },
      stages: { orderBy: { type: "asc" }, include: { act: true } },
      payments: { select: { amount: true, status: true } },
    },
  })

  const specialistAvatarById = new Map<string, string | null>()
  const ordersForClient = await Promise.all(
    orders.map(async o => {
      if (!o.specialist) return { ...o, specialist: null }
      let avatarUrl = specialistAvatarById.get(o.specialist.id)
      if (avatarUrl === undefined) {
        const avatarKey = o.specialist.files?.[0]?.s3Key ?? null
        avatarUrl = avatarKey ? (await getDownloadUrl(avatarKey)).url : null
        specialistAvatarById.set(o.specialist.id, avatarUrl)
      }
      return {
        ...o,
        specialist: {
          name: (o.specialist.specialistProfile?.formData as Record<string, string> | null)?.fullName ?? o.specialist.name,
          email: o.specialist.email ?? "",
          avatarUrl,
        },
        stages: sortStages(o.stages),
      }
    })
  )

  const payments = await prisma.payment.findMany({
    where: { order: { clientId: dbUser.id, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { id: true, briefData: true } } },
  })

  const invoices = await prisma.invoice.findMany({
    where: { order: { clientId: dbUser.id, deletedAt: null } },
    orderBy: { createdAt: "desc" },
  })

  const contracts = (await prisma.contract.findMany({
    where: { order: { clientId: dbUser.id, deletedAt: null } },
    orderBy: { createdAt: "desc" },
  })).map(c => ({
    id: c.id,
    number: c.number,
    orderId: c.orderId,
    status: c.status,
    s3Key: c.s3Key,
    createdAt: c.createdAt,
    signedAt: c.clientSignedAt ?? c.specialistSignedAt ?? null,
  }))

  const contractsForClient: ClientContract[] = contracts.map(c => ({
    id: c.id,
    number: c.number,
    orderId: c.orderId,
    status: c.status,
    s3Key: c.s3Key,
    createdAt: c.createdAt,
    signedAt: c.signedAt,
  }))

  // Collect acts from all stages
  const acts = orders.flatMap(o =>
    o.stages.filter(s => s.act).map(s => ({
      id: s.act!.id,
      stageType: s.type,
      orderId: o.id,
      generatedAt: s.act!.generatedAt.toISOString(),
      signedAt: s.act!.signedAt?.toISOString() ?? null,
    }))
  )

  return (
    <ClientCabinetPage
      name={displayName}
      email={user.email}
      formData={formDataForClient}
      orders={ordersForClient}
      payments={payments}
      invoices={invoices}
      contracts={contractsForClient}
      acts={acts}
      frameworkContract={frameworkContract}
    />
  )
}
