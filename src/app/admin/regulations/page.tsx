import {redirect} from "next/navigation"
import {getSessionUser} from "@/lib/session"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {buildDefaultRegulationsMarkdown, getRegulationsDocument} from "@/lib/regulations"
import RegulationsEditorClient from "./RegulationsEditorClient"

export const dynamic = "force-dynamic"

export default async function AdminRegulationsPage() {
    const user = await getSessionUser()
    if (!user) redirect("/login")
    if (user.role !== "ADMIN") redirect("/login")

    const document = await getRegulationsDocument()

    return (
        <AdminLayout>
            <RegulationsEditorClient document={document} defaultContent={buildDefaultRegulationsMarkdown()}/>
        </AdminLayout>
    )
}
