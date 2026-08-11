"use client"

import Link from "next/link"
import {useSearchParams} from "next/navigation"
import {Suspense} from "react"

function friendlyAuthError(code: string | null): string {
    switch (code) {
        case "EmailSignin":
            return "Не удалось отправить письмо или подтвердить вход."
        case "Configuration":
            return "Вход временно недоступен."
        case "AccessDenied":
            return "Вход недоступен."
        case "Verification":
            return "Ссылка недействительна."
        default:
            return "Не удалось выполнить вход."
    }
}

function ErrorContent() {
    const params = useSearchParams()
    const code = params.get("error")
    return (
        <div style={{textAlign: "center", maxWidth: 420, padding: "0 1rem"}}>
            <p style={{color: "#f4f4f4", fontSize: "1rem", lineHeight: 1.5, margin: "0 0 1.25rem"}}>
                {friendlyAuthError(code)}
            </p>
            <Link href="/login"
                  style={{color: "rgba(255,255,255,0.85)", textDecoration: "underline", fontSize: "0.95rem"}}>
                Перейти ко входу
            </Link>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <main className="flex w-full flex-col items-center justify-center py-8">
            <Suspense fallback={<p style={{color: "rgba(255,255,255,0.5)"}}>Загрузка…</p>}>
                <ErrorContent/>
            </Suspense>
        </main>
    )
}
