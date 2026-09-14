import {notFound} from "next/navigation"
import {ADMIN_ORDER_TABS, parseTabSegment} from "@/lib/admin-routes"
import {OrderDetailRoute} from "../../OrderDetailRoute"

export default async function AdminOrderPage({params}: {
    params: Promise<{ id: string; tab?: string[] }>
}) {
    const {id, tab} = await params
    const activeTab = parseTabSegment(tab, ADMIN_ORDER_TABS)
    if (activeTab === null) notFound()
    return <OrderDetailRoute id={id} activeTab={activeTab ?? "overview"}/>
}
