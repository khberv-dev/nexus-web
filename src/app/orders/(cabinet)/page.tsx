import {redirect} from "next/navigation"
import {ClientOrdersSection} from "@/components/Client/client-cabinet/ClientCabinetSections"
import {CLIENT_CABINET_SECTIONS, type ClientCabinetSection, clientSectionHref} from "@/lib/cabinet-shell"

export default async function ClientOrdersPage({searchParams}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    // Старые ссылки `/orders?tab=payments` (письма, уведомления в БД) → адрес раздела.
    const {tab} = await searchParams
    if (typeof tab === "string" && tab !== "orders" && (CLIENT_CABINET_SECTIONS as readonly string[]).includes(tab)) {
        redirect(clientSectionHref(tab as ClientCabinetSection))
    }
    return <ClientOrdersSection/>
}
