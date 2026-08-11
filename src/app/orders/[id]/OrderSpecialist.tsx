export function OrderSpecialist({specialist}: {
    specialist: { name: string | null; email: string; avatarUrl: string | null }
}) {
    const displayName = specialist.name ?? "Дизайнер"
    return (
        <div style={{
            background: "var(--dash-surface)",
            borderRadius: 14,
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            border: "1px solid var(--dash-border)",
            display: "flex",
            alignItems: "center",
            gap: "1rem"
        }}>
            {specialist.avatarUrl ? (
                <img src={specialist.avatarUrl} alt=""
                     style={{width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0}}/>
            ) : (
                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, hsl(247,60%,58%), hsl(282,60%,48%))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#fff",
                    flexShrink: 0
                }}>
                    {displayName[0].toUpperCase()}
                </div>
            )}
            <div style={{flex: 1}}>
                <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: "0 0 2px"}}>Ваш дизайнер</p>
                <p style={{
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "var(--dash-text)",
                    margin: 0
                }}>{displayName}</p>
            </div>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 8,
                background: "var(--dash-success-bg)",
                color: "var(--dash-success)",
                fontSize: "0.78rem",
                fontWeight: 500
            }}>
                <i className="bx bx-check-circle"/>Назначен
            </div>
        </div>
    )
}
