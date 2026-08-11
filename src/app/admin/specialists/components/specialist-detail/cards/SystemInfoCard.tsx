import type {RawSpecialist} from "../../../types"

export function SystemInfoCard({specialist}: { specialist: RawSpecialist }) {
    const prof = specialist.specialistProfile
    const rows = [
        {label: "ID пользователя", value: specialist.id, icon: "bx-hash", color: "#94a3b8"},
        {label: "Email", value: specialist.email, icon: "bx-envelope", color: "#0ea5e9"},
        {label: "Телефон (аккаунт)", value: specialist.phone, icon: "bx-phone", color: "#22c55e"},
        {label: "Имя в системе", value: specialist.name, icon: "bx-user", color: "#a78bfa"},
        {
            label: "Регистрация",
            value: new Date(specialist.createdAt).toLocaleString("ru-RU"),
            icon: "bx-calendar",
            color: "#f59e0b"
        },
        ...(prof
            ? [
                {label: "ID профиля специалиста", value: prof.id, icon: "bx-id-card", color: "#64748b"},
                {
                    label: "Профиль создан",
                    value: new Date(prof.createdAt).toLocaleString("ru-RU"),
                    icon: "bx-time",
                    color: "#64748b",
                },
            ]
            : []),
    ]

    return (
        <div className="sp-card">
            <div className="sp-card-hd"><span className="sp-label">Системная информация</span></div>
            <div className="sp-card-bd">
                <div className="sp-info-grid">
                    {rows.map((item) => (
                        <div key={item.label} className="sp-info-item">
                            <div className="sp-info-icon" style={{background: `${item.color}18`, color: item.color}}>
                                <i className={`bx ${item.icon}`}/>
                            </div>
                            <div style={{minWidth: 0}}>
                                <div className="sp-info-label">{item.label}</div>
                                <div className={`sp-info-value${item.value ? "" : " sp-info-value--empty"}`}
                                     title={typeof item.value === "string" ? item.value : undefined}>
                                    {item.value || "—"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
