import {notFound, redirect} from "next/navigation"
import {Suspense} from "react"
import {AuthCard} from "@/components/auth/AuthCard"
import {authHref, canSignUp, parseAuthRoleSegment} from "@/lib/auth/auth-routes"

/** Регистрация: `/register` (специалист), `/register/client`. Администратор только входит. */
export default async function RegisterPage({params}: { params: Promise<{ role?: string[] }> }) {
    const role = parseAuthRoleSegment((await params).role)
    if (!role) notFound()
    if (!canSignUp(role)) redirect(authHref("signin", role))

    return (
        <Suspense>
            <AuthCard mode="signup" role={role}/>
        </Suspense>
    )
}
