"use client"

import {useRouter} from "next/navigation"

export default function ForbiddenPage() {
    const router = useRouter()

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "2rem 1.5rem",
                background:
                    "radial-gradient(1150px 440px at 50% 102%, hsla(215, 88%, 64%, 0.18), transparent 62%)," +
                    "radial-gradient(1200px 680px at 12% 8%, hsla(215, 88%, 64%, 0.15), transparent 55%)," +
                    "radial-gradient(980px 620px at 88% 0%, hsla(282, 82%, 62%, 0.14), transparent 60%)," +
                    "linear-gradient(145deg, hsl(258, 52%, 13%) 0%, hsl(270, 54%, 10%) 54%, hsl(248, 50%, 12%) 100%)",
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
            }}
        >
            <p style={{
                margin: 0,
                fontSize: "clamp(4.5rem, 12vw, 7rem)",
                fontWeight: 500,
                lineHeight: 1,
                color: "rgba(255,255,255,0.92)",
            }}>
                403
            </p>
            <h1 style={{
                margin: "0.75rem 0 0",
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 500,
                color: "#f4f4f4",
            }}>
                Доступ запрещён
            </h1>
            <p style={{
                margin: "1rem 0 2rem",
                maxWidth: 440,
                fontSize: "1.05rem",
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.65)",
            }}>
                У вас нет прав для выполнения этого действия. Если считаете, что это ошибка, обратитесь к администратору.
            </p>
            <button
                type="button"
                onClick={() => router.back()}
                style={{
                    padding: "0.75em 1.75em",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#f4f4f4",
                    fontFamily: "inherit",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    cursor: "pointer",
                }}
            >
                Назад
            </button>
        </main>
    );
}
