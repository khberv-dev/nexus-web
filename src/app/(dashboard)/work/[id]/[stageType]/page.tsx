import {notFound, redirect} from "next/navigation"
import type {StageType} from "@prisma/client"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {isStageUnlockedForClient, STAGE_ORDER} from "@/lib/stage-order"
import WorkOrderClient from "../WorkOrderClient"
import {loadSpecialistWorkOrderBundle} from "../specialist-work-order-bundle"

export default async function SpecialistWorkStagePage({params}: {
    params: Promise<{ id: string; stageType: string }>
}) {
    const {id, stageType} = await params
    const user = await getSessionUser()
    if (!user) redirect("/login")

    const dbUser = await prisma.user.findUnique({where: {id: user.id}})
    if (!dbUser) redirect("/login")

    if (!(STAGE_ORDER as readonly string[]).includes(stageType)) notFound()

    const bundle = await loadSpecialistWorkOrderBundle(id, dbUser.id)
    if (!bundle) notFound()

    const type = stageType as StageType
    if (!isStageUnlockedForClient(bundle.order.stages, type)) {
        redirect(`/work/${id}`)
    }

    return (
        <WorkOrderClient
            email={user.email}
            briefHelpRequested={bundle.briefHelpRequested}
            pipelineStages={bundle.pipelineStages}
            order={bundle.order}
            focusedStageType={type}
        />
    )
}
