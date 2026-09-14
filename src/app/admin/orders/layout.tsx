import {Suspense, type ReactNode} from "react"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {OrdersShell} from "./OrdersShell"

export default function AdminOrdersLayout({children}: { children: ReactNode }) {
    return (
        <AdminLayout noPadding>
            <Suspense>
                <OrdersShell>{children}</OrdersShell>
            </Suspense>
        </AdminLayout>
    )
}
