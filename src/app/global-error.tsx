"use client"

import * as Sentry from "@sentry/nextjs"
import {useEffect} from "react"

export default function GlobalError({error}: { error: Error & { digest?: string } }) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html lang="ru">
        <body style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "sans-serif",
            background: "#0a0a0a",
            color: "#f4f4f4"
        }}>
        <div style={{textAlign: "center"}}>
            <h1 style={{fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem"}}>Что-то пошло не так</h1>
            <p style={{color: "rgba(255,255,255,0.5)", fontSize: "0.9rem"}}>Ошибка зафиксирована. Попробуйте обновить
                страницу.</p>
            <button
                onClick={() => window.location.reload()}
                style={{
                    marginTop: "1.5rem",
                    padding: "0.6em 1.5em",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#f4f4f4",
                    cursor: "pointer",
                    fontSize: "0.9rem"
                }}
            >
                Обновить
            </button>
        </div>
        </body>
        </html>
    )
}
