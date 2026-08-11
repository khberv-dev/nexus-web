"use client"

export function StagePaymentSection({
                                        acting,
                                        skipPayments,
                                        price,
                                        onPay,
                                    }: {
    acting: boolean
    skipPayments: boolean
    price?: number | null
    onPay: () => void
}) {
    return (
        <div
            style={{
                marginTop: "1rem",
                padding: "1.25rem",
                borderRadius: 10,
                background: "var(--dash-accent-bg)",
                border: "1.5px solid var(--dash-accent)",
                textAlign: "center",
            }}
        >
            <i className="bx bx-wallet"
               style={{fontSize: "2rem", color: "var(--dash-accent)", marginBottom: "0.5rem"}}/>
            <h3 style={{margin: "0 0 4px", fontSize: "1rem", color: "var(--dash-text)"}}>
                {skipPayments ? "Оплата отключена" : "Ожидается аванс"}
            </h3>
            <p style={{fontSize: "0.82rem", color: "var(--dash-text2)", marginBottom: "1rem"}}>
                {skipPayments ? "Биллинг временно отключен. Можно продолжать без оплаты." : "Для начала работ над этапом необходимо внести предоплату"}
                {price ? <b>: {(price / 100).toLocaleString("ru-RU")} руб.</b> : null}
            </p>
            <button
                onClick={onPay}
                disabled={acting}
                style={{
                    padding: "0.7em 2em",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--dash-accent)",
                    color: "#fff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: acting ? "default" : "pointer",
                    fontFamily: "inherit",
                }}
            >
                {acting ? "..." : skipPayments ? "Продолжить" : "Оплатить аванс"}
            </button>
        </div>
    )
}

