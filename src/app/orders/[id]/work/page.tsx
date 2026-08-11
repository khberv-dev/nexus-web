import {redirect} from "next/navigation"
import {prisma} from "@/lib/db/prisma"
import {getDefaultClientWorkStageType, sortStages} from "@/lib/stage-order"
import {getSessionDbUser, getSessionUser} from "@/lib/session"

export default async function OrderWorkPage({params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) redirect("/login")
    if (user.role === "SPECIALIST") redirect("/work")
    if (user.role === "ADMIN") redirect("/admin")

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) redirect("/login")

    const {id} = await params
    const order = await prisma.order.findFirst({
        where: {id, clientId: dbUser.id, deletedAt: null},
        select: {stages: {select: {type: true, status: true}}},
    })
    if (!order) redirect("/orders")

    const target = getDefaultClientWorkStageType(sortStages(order.stages))
    redirect(`/orders/${id}/work/${target}`)
}

