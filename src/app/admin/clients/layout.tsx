import {Suspense, type ReactNode} from "react"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {ClientsShell} from "./ClientsShell"

export default function AdminClientsLayout({children}: { children: ReactNode }) {
    return (
        <AdminLayout noPadding>
            <Suspense>
                <ClientsShell>{children}</ClientsShell>
            </Suspense>
        </AdminLayout>
    )
}
