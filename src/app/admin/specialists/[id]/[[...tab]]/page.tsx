import {notFound} from "next/navigation"
import {ADMIN_SPECIALIST_TABS, parseTabSegment} from "@/lib/admin-routes"
import {SpecialistDetailRoute} from "../../components/SpecialistDetailRoute"

export default async function AdminSpecialistPage({params}: {
    params: Promise<{ id: string; tab?: string[] }>
}) {
    const {id, tab} = await params
    if (parseTabSegment(tab, ADMIN_SPECIALIST_TABS) === null) notFound()
    return <SpecialistDetailRoute id={id}/>
}
