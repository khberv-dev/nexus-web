import {formatEdoProvidersLabel} from "@/lib/edo-providers"
import {splitPortfolioLinks} from "@/components/ui/PortfolioLinksField"
import {SPECIALIST_FORMDATA_KNOWN} from "../constants"
import {boolRu} from "../utils"

export function QuestionnaireCard({
                                      formData: fd,
                                  }: {
    formData: Record<string, string>
}) {
    const taxLabel = fd.taxStatus === "IP" ? "ИП" : fd.taxStatus === "SZ" ? "Самозанятый" : fd.taxStatus === "OOO" ? "ООО" : ""
    const extraFormEntries = Object.entries(fd).filter(
        ([k, v]) => !SPECIALIST_FORMDATA_KNOWN.has(k) && String(v ?? "").trim() !== "",
    )

    if (!Object.values(fd).some(Boolean)) {
        return (
            <div className="sp-warn"><i className="bx bx-info-circle" style={{marginRight: 6}}/>Анкета не заполнена
            </div>
        )
    }

    return (
        <div className="sp-card">
            <div className="sp-card-hd"><span className="sp-label">Анкета специалиста</span></div>
            <div className="sp-card-bd">
                <div className="sp-info-grid">
                    {[
                        {label: "ФИО", value: fd.fullName, icon: "bx-user", color: "#6366f1"},
                        {label: "Телефон (в анкете)", value: fd.phone, icon: "bx-phone", color: "#0ea5e9"},
                        {label: "Город", value: fd.city, icon: "bx-map", color: "#6366f1"},
                        {
                            label: "Опыт",
                            value: fd.experience ? `${fd.experience} лет` : "",
                            icon: "bx-briefcase",
                            color: "#f59e0b"
                        },
                        {label: "Реализовано м²", value: fd.sqm, icon: "bx-shape-square", color: "#14b8a6"},
                        {label: "Интерьерный стиль", value: fd.interiorStyle, icon: "bx-palette", color: "#d946ef"},
                        {
                            label: "Специализация",
                            value: fd.specialty || fd.specialization,
                            icon: "bx-target-lock",
                            color: "#f97316"
                        },
                        {label: "Программы", value: fd.software, icon: "bx-wrench", color: "#22c55e"},
                        {label: "Нейросети", value: fd.aiServices, icon: "bx-bot", color: "#a855f7"},
                        {label: "3D моделирование", value: boolRu(fd.has3d) || "—", icon: "bx-cube", color: "#8b5cf6"},
                        {label: "Чертежи", value: boolRu(fd.hasRd) || "—", icon: "bx-file", color: "#8b5cf6"},
                        {
                            label: "ЭДО",
                            value: formatEdoProvidersLabel(fd.edoProviders) || "Не указано",
                            icon: "bx-transfer-alt",
                            color: "#3b82f6",
                        },
                        ...(fd.edoOperator?.trim()
                            ? [{
                                label: "ЭДО (текст, договор)",
                                value: fd.edoOperator.trim(),
                                icon: "bx-edit-alt",
                                color: "#38bdf8",
                            }]
                            : []),
                    ].map((item) => (
                        <div key={item.label} className="sp-info-item">
                            <div className="sp-info-icon" style={{background: `${item.color}18`, color: item.color}}>
                                <i className={`bx ${item.icon}`}/>
                            </div>
                            <div style={{minWidth: 0}}>
                                <div className="sp-info-label">{item.label}</div>
                                <div
                                    className={`sp-info-value${item.value && item.value !== "—" ? "" : " sp-info-value--empty"}`}>{item.value || "—"}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {fd.portfolio && (
                    <div className="sp-info-item" style={{marginTop: 10}}>
                        <div className="sp-info-icon" style={{background: "rgba(14,165,233,0.1)", color: "#0ea5e9"}}>
                            <i className="bx bx-link"/>
                        </div>
                        <div style={{minWidth: 0}}>
                            <div className="sp-info-label">Портфолио</div>
                            <div style={{display: "grid", gap: 4}}>
                                {splitPortfolioLinks(fd.portfolio).map((link) => (
                                    <a key={link} href={link} target="_blank" rel="noopener noreferrer"
                                       className="sp-info-link">{link}</a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {(taxLabel || fd.inn || fd.bankAccount) && (
                    <div style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.08))"
                    }}>
                        <div className="sp-info-label" style={{marginBottom: 8}}>Налоговый статус и реквизиты</div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: 10,
                            fontSize: "0.82rem"
                        }}>
                            <div><span style={{color: "var(--adm-muted)"}}>Статус: </span>{taxLabel || "—"}</div>
                            {fd.taxStatus === "OOO" && <div style={{gridColumn: "1 / -1"}}><span
                                style={{color: "var(--adm-muted)"}}>Наименование: </span>{fd.companyName || "—"}</div>}
                            <div><span style={{color: "var(--adm-muted)"}}>ИНН: </span>{fd.inn || "—"}</div>
                            {fd.taxStatus === "IP" &&
                                <div><span style={{color: "var(--adm-muted)"}}>ОГРНИП: </span>{fd.ogrnip || "—"}</div>}
                            {fd.taxStatus === "OOO" &&
                                <div><span style={{color: "var(--adm-muted)"}}>КПП: </span>{fd.kpp || "—"}</div>}
                            {fd.taxStatus === "OOO" &&
                                <div><span style={{color: "var(--adm-muted)"}}>ОГРН: </span>{fd.ogrn || "—"}</div>}
                            {fd.ipName ? <div style={{gridColumn: "1 / -1"}}><span style={{color: "var(--adm-muted)"}}>ФИО (ИП): </span>{fd.ipName}
                            </div> : null}
                            {fd.taxStatus === "OOO" && <div style={{gridColumn: "1 / -1"}}><span
                                style={{color: "var(--adm-muted)"}}>Юр. адрес: </span>{fd.legalAddress || "—"}</div>}
                            <div><span style={{color: "var(--adm-muted)"}}>Р/с: </span>{fd.bankAccount || "—"}</div>
                            <div><span style={{color: "var(--adm-muted)"}}>Банк: </span>{fd.bankName || "—"}</div>
                            <div><span style={{color: "var(--adm-muted)"}}>БИК: </span>{fd.bankBik || "—"}</div>
                            {fd.taxStatus === "OOO" && <div><span
                                style={{color: "var(--adm-muted)"}}>Корр. счет: </span>{fd.corrAccount || "—"}</div>}
                        </div>
                    </div>
                )}
                {fd.about && (
                    <div className="sp-about" style={{marginTop: 12}}>
                        <div className="sp-info-label">О себе</div>
                        <p className="sp-about-text">{fd.about}</p>
                    </div>
                )}
                {extraFormEntries.length > 0 && (
                    <div style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.08))"
                    }}>
                        <div className="sp-info-label" style={{marginBottom: 8}}>Прочие поля анкеты</div>
                        <div style={{display: "grid", gap: 6, fontSize: "0.8rem"}}>
                            {extraFormEntries.map(([k, v]) => (
                                <div key={k} style={{wordBreak: "break-word"}}>
                                    <span style={{color: "var(--adm-muted)"}}>{k}: </span>
                                    <span style={{color: "var(--adm-text)"}}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
