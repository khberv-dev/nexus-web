import {redirect} from "next/navigation"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"
import OrderDetailClient from "./OrderDetailClient"
import {sortStages} from "@/lib/stage-order"
import {filterStageFilesVisibleToClient} from "@/lib/client-stage-file-visibility"
import {levelFromTestStep} from "@/lib/landing/specialist-level"

export default async function OrderDetailPage({params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) redirect("/login")
    if (user.role === "SPECIALIST") redirect("/work")
    if (user.role === "ADMIN") redirect("/admin")

    const {id} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) redirect("/login")

    const order = await prisma.order.findFirst({
        where: {id, clientId: dbUser.id, deletedAt: null},
        include: {
            specialist: {
                select: {
                    name: true, email: true,
                    specialistProfile: {
                        select: {
                            formData: true,
                            steps: {where: {type: "TEST"}, select: {comment: true}, take: 1},
                        },
                    },
                    files: {where: {category: "AVATAR"}, orderBy: {createdAt: "desc"}, take: 1, select: {s3Key: true}},
                    landingBundles: {
                        where: {status: "APPROVED"},
                        orderBy: {reviewedAt: "desc"},
                        take: 1,
                        select: {
                            portraitFileId: true, workFileId: true, videoFileId: true,
                            workPos: true, specialty: true, about: true,
                            items: {orderBy: {position: "asc"}, select: {fileId: true}},
                        },
                    },
                },
            },
            stages: {
                orderBy: {type: "asc"},
                include: {
                    files: {
                        orderBy: {uploadedAt: "desc"},
                        select: {id: true, filename: true, uploadedAt: true, audience: true}
                    },
                    reviews: {
                        orderBy: {createdAt: "desc"},
                        take: 25,
                        select: {reviewerRole: true, verdict: true, comment: true, createdAt: true},
                    },
                    act: {
                        select: {
                            id: true, signedAt: true, signedById: true, status: true,
                            generatedAt: true, specialistActS3Key: true, clientActS3Key: true,
                            specialistUploadedAt: true, adminApprovedAt: true,
                            clientSignedAt: true, adminConfirmedAt: true,
                        }
                    },
                    extraPayments: {select: {id: true, amount: true, reason: true, status: true}},
                },
            },
            payments: {select: {id: true, amount: true, status: true}},
            invoices: {
                orderBy: {createdAt: "desc"},
                select: {
                    id: true,
                    number: true,
                    amount: true,
                    status: true,
                    purpose: true,
                    s3Key: true,
                    createdAt: true
                },
            },
            contracts: {
                orderBy: {createdAt: "desc"},
                take: 1,
                select: {
                    id: true, number: true, orderId: true, status: true,
                    s3Key: true, specialistSignedS3Key: true, clientSignedS3Key: true,
                    createdAt: true, sentToSpecialistAt: true, specialistSignedAt: true,
                    sentToClientAt: true, clientSignedAt: true, confirmedAt: true,
                },
            },
        },
    })

    if (!order) redirect("/orders")

    const clientProfile = await prisma.clientProfile.findUnique({
        where: {userId: dbUser.id},
        select: {
            frameworkContractStatus: true,
            frameworkContractNumber: true,
            frameworkContractS3Key: true,
            signedContractS3Key: true,
        },
    })

    const o = order!
    const stagesSorted = sortStages(o.stages)
    const specAvatarKey = o.specialist?.files?.[0]?.s3Key
    const specialistAvatarUrl = specAvatarKey ? (await getDownloadUrl(specAvatarKey)).url : null
    const specialistBundle = o.specialist?.landingBundles?.[0]
    const bundleFileIds = specialistBundle
        ? [specialistBundle.portraitFileId, specialistBundle.workFileId, specialistBundle.videoFileId,
            ...specialistBundle.items.map((item) => item.fileId)].filter((fileId): fileId is string => Boolean(fileId))
        : []
    const bundleFiles = bundleFileIds.length > 0
        ? await prisma.userFile.findMany({where: {id: {in: bundleFileIds}}, select: {id: true, s3Key: true}})
        : []
    const bundleUrls = new Map(await Promise.all(bundleFiles.map(async (file) => {
        const {url} = await getDownloadUrl(file.s3Key)
        return [file.id, url] as const
    })))
    const specialistForm = (o.specialist?.specialistProfile?.formData as Record<string, string> | null) ?? {}
    const specialistLevel = levelFromTestStep(o.specialist?.specialistProfile?.steps?.[0]?.comment ?? null)
    const portraitUrl = specialistBundle?.portraitFileId ? bundleUrls.get(specialistBundle.portraitFileId) : undefined
    const workUrl = specialistBundle?.workFileId ? bundleUrls.get(specialistBundle.workFileId) : undefined

    return (
        <OrderDetailClient
            viewerEmail={dbUser.email ?? ""}
            order={{
                id: o.id,
                status: o.status,
                createdAt: o.createdAt.toISOString(),
                briefData: o.briefData as Record<string, string> | null,
                briefHelpRequested: o.briefHelpRequested,
                specialist: o.specialist ? {
                    name: (o.specialist.specialistProfile?.formData as Record<string, string> | null)?.fullName ?? o.specialist.name,
                    email: o.specialist.email ?? "",
                    avatarUrl: specialistAvatarUrl,
                    profile: specialistBundle && portraitUrl && workUrl ? {
                        name: specialistForm.fullName ?? o.specialist.name ?? "Специалист",
                        specialty: specialistBundle.specialty ?? specialistForm.specialty ?? specialistForm.specialization ?? "",
                        portrait: portraitUrl,
                        avatar: specialistAvatarUrl ?? portraitUrl,
                        work: workUrl,
                        workPos: specialistBundle.workPos ?? "center center",
                        experience: parseInt(specialistForm.experience ?? "0") || 0,
                        sqm: parseInt(specialistForm.sqm ?? "0") || 0,
                        style: specialistForm.interiorStyle ?? specialistForm.specialty ?? specialistForm.specialization ?? "",
                        has3d: specialistForm.has3d === "true",
                        hasRd: specialistForm.hasRd === "true",
                        bio: specialistBundle.about ?? specialistForm.about ?? "",
                        introVideoUrl: specialistBundle.videoFileId
                            ? bundleUrls.get(specialistBundle.videoFileId)
                            : undefined,
                        portfolioImages: specialistBundle.items
                            .map((item) => bundleUrls.get(item.fileId))
                            .filter((url): url is string => Boolean(url)),
                        level: specialistLevel?.code ?? null,
                        levelTitle: specialistLevel?.title ?? null,
                    } : null,
                } : null,
                stages: stagesSorted.map(s => ({
                    id: s.id,
                    type: s.type,
                    status: s.status,
                    modRound: s.modRound,
                    clientRound: s.clientRound,
                    price: s.price ?? null,
                    files: filterStageFilesVisibleToClient({status: s.status, files: s.files, reviews: s.reviews})
                        .map((f) => ({
                            id: f.id,
                            filename: f.filename,
                            createdAt: f.uploadedAt.toISOString(),
                            audience: f.audience
                        })),
                    lastRejectedAt:
                        s.reviews
                            .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
                            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
                            ?.createdAt.toISOString() ?? null,
                    reviews: s.reviews
                        .filter(r => r.reviewerRole !== "MODERATOR")
                        .map(r => ({
                            reviewerRole: r.reviewerRole,
                            verdict: r.verdict,
                            comment: r.comment,
                            createdAt: r.createdAt.toISOString(),
                        })),
                    act: s.act ? {
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
                    } : null,
                    extraPayments: s.extraPayments.map(ep => ({
                        id: ep.id,
                        amount: ep.amount,
                        reason: ep.reason,
                        status: ep.status
                    })),
                })),
                payments: o.payments,
                contracts: o.contracts.map(c => ({
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
                frameworkContract: {
                    status: clientProfile?.frameworkContractStatus ?? "NONE",
                    number: clientProfile?.frameworkContractNumber ?? null,
                    hasFile: Boolean(clientProfile?.frameworkContractS3Key),
                    hasSignedFile: Boolean(clientProfile?.signedContractS3Key),
                },
                invoices: o.invoices.map((inv) => ({
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
