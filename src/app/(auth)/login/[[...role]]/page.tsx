import {notFound} from "next/navigation"
import {Suspense} from "react"
import {AuthCard} from "@/components/auth/AuthCard"
import {parseAuthRoleSegment} from "@/lib/auth/auth-routes"

/** Вход: `/login` (специалист), `/login/client`, `/login/admin`. */
export default async function LoginPage({params}: { params: Promise<{ role?: string[] }> }) {
    const role = parseAuthRoleSegment((await params).role)
    if (!role) notFound()

    return (
        <Suspense>
            <AuthCard mode="signin" role={role}/>
        </Suspense>
    )
}
