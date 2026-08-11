import {notFound, redirect} from "next/navigation"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import WorkOrderClient from "./WorkOrderClient"
import {loadSpecialistWorkOrderBundle} from "./specialist-work-order-bundle"

export default async function WorkOrderPage({params}: { params: Promise<{ id: string }> }) {
    const {id} = await params
    const user = await getSessionUser()
    if (!user) redirect("/login")

    const dbUser = await prisma.user.findUnique({where: {id: user.id}})
    if (!dbUser) redirect("/login")

    const bundle = await loadSpecialistWorkOrderBundle(id, dbUser.id)
    if (!bundle) notFound()

    return (
        <WorkOrderClient
            email={user.email}
            briefHelpRequested={bundle.briefHelpRequested}
            pipelineStages={bundle.pipelineStages}
            order={bundle.order}
        />
    )
}
