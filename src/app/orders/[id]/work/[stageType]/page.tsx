import { redirect, notFound } from "next/navigation"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { getDownloadUrl } from "@/lib/s3"
import {
  getDefaultClientWorkStageType,
  isStageUnlockedForClient,
  sortStages,
  STAGE_ORDER,
} from "@/lib/stage-order"
import { filterStageFilesVisibleToClient } from "@/lib/client-stage-file-visibility"
import type { StageType } from "@prisma/client"
import type { StageType as ClientStageType } from "../../types"
import OrderWorkStageClient from "./OrderWorkStageClient"

export default async function OrderWorkStagePage({
  params,
}: {
  params: Promise<{ id: string; stageType: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role === "SPECIALIST") redirect("/work")
  if (user.role === "ADMIN") redirect("/admin")

  const { id, stageType } = await params
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) redirect("/login")

  const type = stageType as StageType
  if (!(STAGE_ORDER as readonly string[]).includes(type)) notFound()

  const order = await prisma.order.findFirst({
    where: { id, clientId: dbUser.id, deletedAt: null },
    include: {
      specialist: {
        select: {
          name: true,
          email: true,
          specialistProfile: { select: { formData: true } },
          files: {
            where: { category: "AVATAR" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { s3Key: true },
          },
        },
      },
      stages: {
        orderBy: { type: "asc" },
        include: {
          files: { orderBy: { uploadedAt: "desc" }, select: { id: true, filename: true, uploadedAt: true, audience: true } },
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 25,
            select: { reviewerRole: true, verdict: true, comment: true, createdAt: true },
          },
          act: {
            select: {
              id: true,
              signedAt: true,
              signedById: true,
              status: true,
              generatedAt: true,
              specialistActS3Key: true,
              clientActS3Key: true,
              specialistUploadedAt: true,
              adminApprovedAt: true,
              clientSignedAt: true,
              adminConfirmedAt: true,
            },
          },
          extraPayments: { select: { id: true, amount: true, reason: true, status: true } },
        },
      },
      payments: { select: { id: true, amount: true, status: true } },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, amount: true, status: true, purpose: true, s3Key: true, createdAt: true },
      },
      contracts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          number: true,
          orderId: true,
          status: true,
          s3Key: true,
          specialistSignedS3Key: true,
          clientSignedS3Key: true,
          createdAt: true,
          sentToSpecialistAt: true,
          specialistSignedAt: true,
          sentToClientAt: true,
          clientSignedAt: true,
          confirmedAt: true,
        },
      },
    },
  })

  if (!order) redirect("/orders")

  const stagesSorted = sortStages(order.stages)
  if (!isStageUnlockedForClient(stagesSorted, type)) {
    redirect(`/orders/${id}/work/${getDefaultClientWorkStageType(stagesSorted)}`)
  }
  const specAvatarKey = order.specialist?.files?.[0]?.s3Key
  const specialistAvatarUrl = specAvatarKey ? (await getDownloadUrl(specAvatarKey)).url : null

  return (
    <OrderWorkStageClient
      viewerEmail={dbUser.email ?? ""}
      stageType={type as unknown as ClientStageType}
      initialOrder={{
        id: order.id,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        briefData: order.briefData as Record<string, string> | null,
        briefHelpRequested: order.briefHelpRequested,
        specialist: order.specialist
          ? {
              name:
                (order.specialist.specialistProfile?.formData as Record<string, string> | null)?.fullName ??
                order.specialist.name,
              email: order.specialist.email ?? "",
              avatarUrl: specialistAvatarUrl,
            }
          : null,
        stages: stagesSorted.map((s) => ({
          id: s.id,
          type: s.type,
          status: s.status,
          modRound: s.modRound,
          clientRound: s.clientRound,
          price: s.price ?? null,
          rulesS3Key: s.rulesS3Key ?? null,
          files: filterStageFilesVisibleToClient({ status: s.status, files: s.files, reviews: s.reviews })
            .map((f) => ({
              id: f.id,
              filename: f.filename,
              createdAt: f.uploadedAt.toISOString(),
              audience: f.audience,
            })),
          lastRejectedAt:
            s.reviews
              .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
              ?.createdAt.toISOString() ?? null,
          reviews: s.reviews
            .filter((r) => r.reviewerRole !== "MODERATOR")
            .map((r) => ({
              reviewerRole: r.reviewerRole,
              verdict: r.verdict,
              comment: r.comment,
              createdAt: r.createdAt.toISOString(),
            })),
          act: s.act
            ? {
                id: s.act.id,
                signedAt: s.act.signedAt?.toISOString() ?? null,
                signedById: s.act.signedById ?? null,
                status: s.act.status,
                generatedAt: s.act.generatedAt.toISOString(),
                specialistActS3Key: s.act.specialistActS3Key ?? null,
                clientActS3Key: s.act.clientActS3Key ?? null,
                specialistUploadedAt: s.act.specialistUploadedAt?.toISOString() ?? null,
                adminApprovedAt: s.act.adminApprovedAt?.toISOString() ?? null,
                clientSignedAt: s.act.clientSignedAt?.toISOString() ?? null,
                adminConfirmedAt: s.act.adminConfirmedAt?.toISOString() ?? null,
              }
            : null,
          extraPayments: s.extraPayments.map((ep) => ({
            id: ep.id,
            amount: ep.amount,
            reason: ep.reason,
            status: ep.status,
          })),
        })),
        payments: order.payments,
        contracts: order.contracts.map((c) => ({
          id: c.id,
          number: c.number,
          orderId: c.orderId,
          status: c.status,
          s3Key: c.s3Key,
          specialistSignedS3Key: c.specialistSignedS3Key,
          clientSignedS3Key: c.clientSignedS3Key,
          createdAt: c.createdAt.toISOString(),
          sentToSpecialistAt: c.sentToSpecialistAt?.toISOString() ?? null,
          specialistSignedAt: c.specialistSignedAt?.toISOString() ?? null,
          sentToClientAt: c.sentToClientAt?.toISOString() ?? null,
          clientSignedAt: c.clientSignedAt?.toISOString() ?? null,
          confirmedAt: c.confirmedAt?.toISOString() ?? null,
        })),
        invoices: order.invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          amount: inv.amount,
          status: inv.status,
          purpose: inv.purpose,
          s3Key: inv.s3Key,
          createdAt: inv.createdAt.toISOString(),
        })),
      }}
    />
  )
}

