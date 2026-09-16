import {getSessionUser} from "@/lib/session"
import {redirect} from "next/navigation"
import {prisma} from "@/lib/db/prisma"
import "@/components/Community/Community.css"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {buildSpecialistCabinetNavItems} from "@/components/Community/specialist-route-tabs"
import {SPECIALIST_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import SpecialistDashboard from "@/components/Dashboard/SpecialistDashboard"
import type {Prisma} from "@prisma/client"
import {sortStages} from "@/lib/stage-order"
import {getProfileCompleteness} from "@/lib/profile-completeness"
import {formatUserName, formatUserNameLastFirst, userInitial} from "@/lib/user-name"

export default async function WorkDashboard() {
    const user = await getSessionUser()
    if (!user) redirect("/login")

    // Fetch specialist data
    const dbUser = await prisma.user.findUnique({
        where: {id: user.id},
        include: {
            specialistProfile: {
                include: {steps: true},
            },
        },
    })

    if (!dbUser?.specialistProfile) {
        redirect("/onboarding")
    }

    // Fetch orders with stages
    const ordersRaw = await prisma.order.findMany({
        where: {specialistId: dbUser.id},
        orderBy: {updatedAt: "desc"},
        include: {
            client: {select: {firstName: true, lastName: true, email: true}},
            stages: {
                orderBy: {type: "asc"},
                include: {
                    act: {select: {id: true, signedAt: true}},
                },
            },
        },
    })
    const orders = ordersRaw.map(o => ({...o, stages: sortStages(o.stages)}))

    // Fetch payments
    const payments = await prisma.payment.findMany({
        where: {order: {specialistId: dbUser.id}},
        orderBy: {createdAt: "desc"},
        include: {
            order: {select: {id: true}},
        },
    })

    // Заполненность профиля: аватар, проект в портфолио, одобренный лендинг
    const [avatarCount, portfolioProjectCount, landingBundles] = await Promise.all([
        prisma.userFile.count({where: {userId: dbUser.id, category: "AVATAR"}}),
        prisma.portfolioProject.count({where: {userId: dbUser.id}}),
        prisma.landingBundle.findMany({where: {userId: dbUser.id}, select: {status: true}}),
    ])
    const profileCompleteness = getProfileCompleteness({
        hasAvatar: avatarCount > 0,
        portfolioProjectCount,
        landingStatuses: landingBundles.map((b) => b.status),
    })

    // Calculate statistics
    const activeOrders = orders.filter((o) => o.status === "ACTIVE").length
    const completedOrders = orders.filter((o) => o.status === "DONE").length
    const totalEarned = payments
        .filter((p) => p.status === "RELEASED")
        .reduce((sum, p) => sum + p.amount, 0)
    const pendingPayments = payments
        .filter((p) => p.status === "PENDING")
        .reduce((sum, p) => sum + p.amount, 0)

    // Find stages requiring attention
    const urgentStages = orders.flatMap((order) =>
        order.stages
            .filter((s) => s.status === "MOD_REVISION" || s.status === "CLIENT_REVISION")
            .map((stage) => {
                const briefData = order.briefData as Prisma.JsonObject | null
                return {
                    orderId: order.id,
                    orderTitle: typeof briefData?.objectType === "string" ? briefData.objectType : "Проект",
                    stageType: stage.type,
                    stageStatus: stage.status,
                    clientName: formatUserName(order.client) || null,
                }
            })
    )

    const formData = dbUser.specialistProfile.formData as Record<string, string> | null

    return (
        <div className="dash">
            <DashTopHeader
                email={user.email}
                name={formatUserName(user) || null}
                title="Кабинет специалиста"
                logoHref={SPECIALIST_CABINET_LOGO_HREF}
                navItems={buildSpecialistCabinetNavItems("home")}
                primaryAction={{
                    href: SPECIALIST_CABINET_LOGO_HREF,
                    label: "Профиль",
                    iconClassName: "bx bx-user-circle"
                }}
            />
            <DashMainLayout>
                <SpecialistDashboard
                    name={formatUserNameLastFirst(user) || user.email}
                    avatarInitial={userInitial(user)}
                    email={user.email}
                    activeOrders={activeOrders}
                    completedOrders={completedOrders}
                    totalEarned={totalEarned}
                    pendingPayments={pendingPayments}
                    urgentStages={urgentStages}
                    recentOrders={orders.slice(0, 5)}
                    formData={formData}
                    onboardingStatus={dbUser.specialistProfile.onboardingStatus}
                    profileCompleteness={profileCompleteness}
                />
            </DashMainLayout>
        </div>
    )
}
