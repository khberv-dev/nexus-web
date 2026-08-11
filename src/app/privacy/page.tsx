import Link from "next/link"
import {AppCard} from "@/components/app/AppCard"

export default function PrivacyPage() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#0f1535",
                zIndex: 50,
                overflowY: "auto",
                fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
            }}
        >
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1.1rem 2rem",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(15,21,53,0.92)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                }}
            >
                <Link href="/" style={{color: "#f4f4f4", fontSize: "1.2rem", fontWeight: 500, textDecoration: "none"}}>
                    NEXUS
                </Link>
                <Link
                    href="/login"
                    style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.85rem",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4em",
                    }}
                >
                    ← Войти
                </Link>
            </div>

            <div style={{maxWidth: 600, margin: "0 auto", padding: "2.5rem 1.5rem 4rem"}}>
                <div style={{marginBottom: "2rem"}}>
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.8rem)", fontWeight: 500, margin: 0}}>
                        Политика конфиденциальности и персональные данные
                    </h1>
                    <p style={{
                        color: "rgba(255,255,255,0.4)",
                        marginTop: "0.5em",
                        fontSize: "0.9rem",
                        lineHeight: 1.5
                    }}>
                        Условия обработки данных на платформе NEXUS. Полный юридический текст можно заменить при
                        необходимости.
                    </p>
                </div>

                <AppCard>
                    <div style={{display: "flex", flexDirection: "column", gap: "1.5rem"}}>
                        <section>
                            <h2 style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                margin: "0 0 0.5rem"
                            }}>
                                Введение
                            </h2>
                            <p style={{
                                margin: 0,
                                color: "rgba(255,255,255,0.45)",
                                fontSize: "0.9rem",
                                lineHeight: 1.65
                            }}>
                                При регистрации и использовании сервиса вы подтверждаете ознакомление с принципами
                                обработки персональных
                                данных. Ниже — краткая структура; итоговый документ утверждается оператором платформы.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                margin: "0 0 0.5rem"
                            }}>
                                Персональные данные
                            </h2>
                            <p style={{
                                margin: 0,
                                color: "rgba(255,255,255,0.45)",
                                fontSize: "0.9rem",
                                lineHeight: 1.65
                            }}>
                                К ним могут относиться: адрес электронной почты, ФИО, номер телефона, сведения из анкет,
                                брифов и
                                переписки в рамках платформы. Обработка ведется для регистрации, исполнения договоров,
                                связи с
                                пользователем и улучшения сервиса.
                            </p>
                        </section>

                        <section>
                            <h2 style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                margin: "0 0 0.5rem"
                            }}>
                                Согласие
                            </h2>
                            <p style={{
                                margin: 0,
                                color: "rgba(255,255,255,0.45)",
                                fontSize: "0.9rem",
                                lineHeight: 1.65
                            }}>
                                Отмечая соответствующий пункт в форме регистрации или заказа, вы даете согласие на
                                обработку указанных
                                данных в объеме, необходимом для работы платформы, в соответствии с применимым
                                законодательством.
                            </p>
                        </section>

                        <p style={{
                            margin: 0,
                            paddingTop: "0.25rem",
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "0.8rem",
                            textAlign: "center"
                        }}>
                            <Link href="/login" style={{color: "rgba(255,255,255,0.6)", textDecoration: "none"}}>
                                Войти
                            </Link>
                        </p>
                    </div>
                </AppCard>
            </div>
        </div>
    )
}
