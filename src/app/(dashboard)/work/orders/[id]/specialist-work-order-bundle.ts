import type {StageType} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {sortStages} from "@/lib/stage-order"
import type {ActStatus, OrderStage as PipelineStage, StageStatus} from "@/app/orders/[id]/types"
import {STAGE_LABEL} from "@/app/orders/[id]/types"

function lastRejectedAtIso(reviews: { verdict: string; createdAt: Date }[]): string | null {
    const rej = reviews.filter(r => r.verdict === "REJECTED")
    if (rej.length === 0) return null
    rej.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return rej[0]!.createdAt.toISOString()
}

export type SpecialistWorkOrderBundle = {
    briefHelpRequested: boolean
    pipelineStages: PipelineStage[]
    order: {
        id: string
        status: string
        createdAt: string
        briefData: Record<string, string> | null
        client: { name: string | null; email: string }
        stages: Array<{
            id: string
            type: StageType
            label: string
            status: string
            modRound: number
            clientRound: number
            rulesS3Key?: string | null
            rulesSentAt?: string | null
            rulesSentS3Key?: string | null
            rulesAckAt?: string | null
            rulesAckS3Key?: string | null
            files: Array<{
                id: string;
                filename: string;
                createdAt: string;
                hasAnnotations?: boolean;
                audience?: "DESIGNER" | "CLIENT" | "SHARED"
            }>
            reviews: Array<{
                id: string;
                reviewerRole: string;
                verdict: string;
                comment: string | null;
                createdAt: string
            }>
            act: {
                id: string
                signedAt: string | null
                signedById: string | null
                status: string
                generatedAt: string
                specialistActS3Key: string | null
                clientActS3Key: string | null
                specialistUploadedAt: string | null
                adminApprovedAt: string | null
                clientSignedAt: string | null
                adminConfirmedAt: string | null
            } | null
            extraPayments: Array<{ id: string; amount: number; reason: string; status: string }>
        }>
        payments: Array<{ id: string; amount: number; status: string }>
        contract: {
            id: string
            number: string
            status: string
            s3Key: string | null
            specialistSignedS3Key: string | null
            clientSignedS3Key: string | null
            sentToSpecialistAt: string | null
            specialistSignedAt: string | null
            sentToClientAt: string | null
            clientSignedAt: string | null
            confirmedAt: string | null
        } | null
    }
}

export async function loadSpecialistWorkOrderBundle(orderId: string, specialistUserId: string): Promise<SpecialistWorkOrderBundle | null> {
    const order = await prisma.order.findFirst({
        where: {id: orderId, specialistId: specialistUserId},
        include: {
            client: {select: {name: true, email: true, clientProfile: {select: {formData: true}}}},
            stages: {
                orderBy: {type: "asc"},
                include: {
                    files: {
                        orderBy: {uploadedAt: "desc"},
                        select: {id: true, filename: true, uploadedAt: true, annotations: true, audience: true}
                    },
                    reviews: {
                        orderBy: {createdAt: "desc"},
                        take: 25,
                        select: {id: true, reviewerRole: true, verdict: true, comment: true, createdAt: true}
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
                    extraPayments: {select: {id: true, amount: true, reason: true, status: true}},
                },
            },
            payments: {orderBy: {createdAt: "desc"}, select: {id: true, amount: true, status: true}},
            contracts: {
                orderBy: {createdAt: "desc"},
                take: 1,
                select: {
                    id: true,
                    number: true,
                    status: true,
                    s3Key: true,
                    specialistSignedS3Key: true,
                    clientSignedS3Key: true,
                    sentToSpecialistAt: true,
                    specialistSignedAt: true,
                    sentToClientAt: true,
                    clientSignedAt: true,
                    confirmedAt: true,
                },
            },
        },
    })

    if (!order) return null

    const stagesSorted = sortStages(order.stages)
    const pipelineStages: PipelineStage[] = stagesSorted.map(s => ({
        id: s.id,
        type: s.type,
        status: s.status as StageStatus,
        modRound: s.modRound,
        clientRound: s.clientRound,
        files: s.files.map(f => ({
            id: f.id,
            filename: f.filename,
            createdAt: f.uploadedAt.toISOString(),
            audience: f.audience,
        })),
        reviews: s.reviews.map(r => ({
            id: r.id,
            reviewerRole: r.reviewerRole,
            verdict: r.verdict,
            comment: r.comment,
            createdAt: r.createdAt.toISOString(),
        })),
        lastRejectedAt: lastRejectedAtIso(s.reviews),
        act: s.act
            ? {
                id: s.act.id,
                signedAt: s.act.signedAt?.toISOString() ?? null,
                signedById: s.act.signedById ?? null,
                status: s.act.status as ActStatus,
                generatedAt: s.act.generatedAt.toISOString(),
                specialistActS3Key: s.act.specialistActS3Key ?? null,
                clientActS3Key: s.act.clientActS3Key ?? null,
                specialistUploadedAt: s.act.specialistUploadedAt?.toISOString() ?? null,
                adminApprovedAt: s.act.adminApprovedAt?.toISOString() ?? null,
                clientSignedAt: s.act.clientSignedAt?.toISOString() ?? null,
                adminConfirmedAt: s.act.adminConfirmedAt?.toISOString() ?? null,
            }
            : null,
        extraPayments: s.extraPayments.map(ep => ({
            id: ep.id,
            amount: ep.amount,
            reason: ep.reason,
            status: ep.status
        })),
    }))

    const clientFd = order.client.clientProfile?.formData as Record<string, string> | null
    const clientName = clientFd?.fullName ?? order.client.name

    return {
        briefHelpRequested: order.briefHelpRequested,
        pipelineStages,
        order: {
            id: order.id,
            status: order.status,
            createdAt: order.createdAt.toISOString(),
            briefData: order.briefData as Record<string, string> | null,
            client: {name: clientName, email: order.client.email ?? ""},
            stages: stagesSorted.map(s => ({
                id: s.id,
                type: s.type,
                label: STAGE_LABEL[s.type],
                status: s.status,
                modRound: s.modRound,
                clientRound: s.clientRound,
                rulesS3Key: s.rulesS3Key,
                rulesSentAt: (s as { rulesSentAt?: Date | null }).rulesSentAt?.toISOString() ?? null,
                rulesSentS3Key: (s as { rulesSentS3Key?: string | null }).rulesSentS3Key ?? null,
                rulesAckAt: (s as { rulesAckAt?: Date | null }).rulesAckAt?.toISOString() ?? null,
                rulesAckS3Key: (s as { rulesAckS3Key?: string | null }).rulesAckS3Key ?? null,
                files: s.files.map(f => ({
                    id: f.id,
                    filename: f.filename,
                    createdAt: f.uploadedAt.toISOString(),
                    hasAnnotations: Array.isArray(f.annotations) && f.annotations.length > 0,
                    audience: f.audience,
                })),
                reviews: s.reviews.map(r => ({
                    id: r.id,
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
                extraPayments: s.extraPayments.map(ep => ({
                    id: ep.id,
                    amount: ep.amount,
                    reason: ep.reason,
                    status: ep.status
                })),
            })),
            payments: order.payments,
            contract: order.contracts[0]
                ? {
                    id: order.contracts[0].id,
                    number: order.contracts[0].number,
                    status: order.contracts[0].status,
                    s3Key: order.contracts[0].s3Key ?? null,
                    specialistSignedS3Key: order.contracts[0].specialistSignedS3Key ?? null,
                    clientSignedS3Key: order.contracts[0].clientSignedS3Key ?? null,
                    sentToSpecialistAt: order.contracts[0].sentToSpecialistAt?.toISOString() ?? null,
                    specialistSignedAt: order.contracts[0].specialistSignedAt?.toISOString() ?? null,
                    sentToClientAt: order.contracts[0].sentToClientAt?.toISOString() ?? null,
                    clientSignedAt: order.contracts[0].clientSignedAt?.toISOString() ?? null,
                    confirmedAt: order.contracts[0].confirmedAt?.toISOString() ?? null,
                }
                : null,
        },
    }
}
