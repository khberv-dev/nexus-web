import {getSessionUser} from "@/lib/session"
import {redirect} from "next/navigation"
import {prisma} from "@/lib/db/prisma"
import "@/components/Community/Community.css"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashSidebarNav} from "@/components/dashboard-ui/DashSidebarNav"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {buildSpecialistCabinetNavItems, SPECIALIST_ROUTE_TABS} from "@/components/Community/specialist-route-tabs"
import {SPECIALIST_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import SpecialistDashboard from "@/components/Dashboard/SpecialistDashboard"
import type {Prisma} from "@prisma/client"
import {sortStages} from "@/lib/stage-order"

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
            client: {select: {name: true, email: true}},
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
                    clientName: order.client.name,
                }
            })
    )

    const formData = dbUser.specialistProfile.formData as Record<string, string> | null

    return (
        <div className="dash">
            <DashTopHeader
                email={user.email}
                title="Кабинет специалиста"
                logoHref={SPECIALIST_CABINET_LOGO_HREF}
                navItems={buildSpecialistCabinetNavItems("")}
                primaryAction={{
                    href: SPECIALIST_CABINET_LOGO_HREF,
                    label: "Профиль",
                    iconClassName: "bx bx-user-circle"
                }}
            />
            <DashMainLayout sidebar={<DashSidebarNav tabs={SPECIALIST_ROUTE_TABS} activeTab=""/>}>
                <SpecialistDashboard
                    name={user.name ?? user.email}
                    email={user.email}
                    activeOrders={activeOrders}
                    completedOrders={completedOrders}
                    totalEarned={totalEarned}
                    pendingPayments={pendingPayments}
                    urgentStages={urgentStages}
                    recentOrders={orders.slice(0, 5)}
                    formData={formData}
                    onboardingStatus={dbUser.specialistProfile.onboardingStatus}
                />
            </DashMainLayout>
        </div>
    )
}
