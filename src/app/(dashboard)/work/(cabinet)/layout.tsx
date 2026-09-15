import type {ReactNode} from "react"
import {getSessionUser} from "@/lib/session"
import {redirect} from "next/navigation"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"
import CommunityPage from "@/components/Community/CommunityPage"
import {sortStages} from "@/lib/stage-order"
import {omitNameFields, userDisplayName} from "@/lib/user-name"

/**
 * Общая оболочка разделов кабинета специалиста (/work/orders, /work/portfolio, …):
 * шапка, герой, сайдбар и экскурсия живут здесь и не перемонтируются при переходе
 * между разделами; сами разделы — страницы в соседних папках.
 */
export default async function SpecialistCabinetLayout({children}: { children: ReactNode }) {
    const user = await getSessionUser()
    if (!user) redirect("/login")

    const dbUser = await prisma.user.findUnique({
        where: {id: user.id},
        include: {specialistProfile: {include: {steps: true}}},
    })

    const featuredOnLanding = dbUser?.specialistProfile?.featuredOnLanding ?? false

    const formDataRaw = dbUser?.specialistProfile?.formData as Record<string, string> | null
    // Имя, фамилия и телефон — из User: в анкете они не хранятся.
    const formData: Record<string, string> | null = dbUser
        ? {
            ...(formDataRaw ? omitNameFields(formDataRaw) : {}),
            firstName: dbUser.firstName ?? "",
            lastName: dbUser.lastName ?? "",
            phone: dbUser.phone ?? "",
        }
        : null

    const ordersRaw = dbUser ? await prisma.order.findMany({
        where: {specialistId: dbUser.id},
        orderBy: {updatedAt: "desc"},
        include: {
            client: {select: {firstName: true, lastName: true, email: true}},
            stages: {
                orderBy: {type: "asc"},
                include: {act: {select: {id: true, signedAt: true, generatedAt: true}}},
            },
        },
    }) : []
    const orders = ordersRaw.map(o => ({...o, stages: sortStages(o.stages)}))

    const payments = dbUser ? await prisma.payment.findMany({
        where: {order: {specialistId: dbUser.id}},
        orderBy: {createdAt: "desc"},
        include: {order: {select: {id: true, briefData: true}}},
    }) : []

    // Последний загруженный аватар
    const avatarFile = dbUser ? await prisma.userFile.findFirst({
        where: {userId: dbUser.id, category: "AVATAR"},
        orderBy: {createdAt: "desc"},
    }) : null
    const avatarUrl = avatarFile ? (await getDownloadUrl(avatarFile.s3Key)).url : null

    const projectContracts = dbUser ? await prisma.contract.findMany({
        where: {order: {specialistId: dbUser.id}},
        orderBy: {createdAt: "desc"},
    }) : []

    const onboardingContract =
        dbUser?.specialistProfile?.specialistContractS3Key
            ? {
                id: `onboarding-${dbUser.id}`,
                number: dbUser.specialistProfile.specialistContractNumber ?? "—",
                orderId: null,
                status: dbUser.specialistProfile.specialistContractStatus ?? "AWAITING_SIGNATURE",
                s3Key: dbUser.specialistProfile.specialistContractS3Key,
                createdAt: dbUser.specialistProfile.specialistContractUploadedAt ?? new Date(),
                signedAt: null,
                kind: "ONBOARDING" as const,
            }
            : null

    const contracts = [
        ...(onboardingContract ? [onboardingContract] : []),
        ...projectContracts.map(c => ({
            id: c.id,
            number: c.number,
            orderId: c.orderId,
            status: c.status,
            s3Key: c.s3Key,
            createdAt: c.createdAt,
            signedAt: c.clientSignedAt ?? c.specialistSignedAt ?? null,
            kind: "PROJECT" as const,
        })),
    ]

    const acts = orders.flatMap(o =>
        o.stages.filter(s => s.act).map(s => ({
            id: s.act!.id, stageType: s.type, orderId: o.id,
            generatedAt: s.act!.generatedAt.toISOString(),
            signedAt: s.act!.signedAt?.toISOString() ?? null,
        }))
    )

    return (
        <CommunityPage
            name={userDisplayName(user)}
            email={user.email}
            city={formData?.city}
            experience={formData?.experience}
            software={formData?.software}
            about={formData?.about}
            status={dbUser?.specialistProfile?.onboardingStatus}
            orders={orders}
            payments={payments}
            contracts={contracts}
            acts={acts}
            formData={formData}
            onboardingSteps={dbUser?.specialistProfile?.steps ?? []}
            avatarUrl={avatarUrl}
            featuredOnLanding={featuredOnLanding}
            landingWorkPos={dbUser?.specialistProfile?.landingWorkPos ?? undefined}
            rating={dbUser?.specialistProfile?.rating}
        >
            {children}
        </CommunityPage>
    )
}
