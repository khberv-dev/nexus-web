import {Suspense, type ReactNode} from "react"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {SpecialistsShell} from "./SpecialistsShell"

export default function AdminSpecialistsLayout({children}: { children: ReactNode }) {
    return (
        <AdminLayout noPadding>
            <Suspense>
                <SpecialistsShell>{children}</SpecialistsShell>
            </Suspense>
        </AdminLayout>
    )
}
