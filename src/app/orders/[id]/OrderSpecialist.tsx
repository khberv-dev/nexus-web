"use client"

import {useState} from "react"
import {DesignerProfileModal} from "@/components/landing/designer-profile-modal/DesignerProfileModal"
import type {OrderData} from "./types"

export function OrderSpecialist({specialist}: {
    specialist: NonNullable<OrderData["specialist"]>
}) {
    const [showProfile, setShowProfile] = useState(false)
    const displayName = specialist.name ?? "Дизайнер"
    return (
        <>
        <div style={{
            background: "var(--dash-surface)",
            borderRadius: 14,
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            border: "1px solid var(--dash-border)",
            display: "flex",
            flexWrap: "wrap",
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
            {specialist.profile && (
                <>
                    <div style={{
                        width: "100%",
                        paddingTop: 12,
                        borderTop: "1px solid var(--dash-border)",
                        display: "grid",
                        gap: 8,
                    }}>
                        {(specialist.profile.levelTitle || specialist.profile.specialty) && (
                            <p style={{margin: 0, color: "var(--dash-text2)", fontSize: "0.8rem", lineHeight: 1.45}}>
                                {[specialist.profile.levelTitle, specialist.profile.specialty].filter(Boolean).join(" · ")}
                            </p>
                        )}
                        <div style={{display: "flex", flexWrap: "wrap", gap: "6px 14px"}}>
                            <span style={{fontSize: "0.76rem", color: "var(--dash-muted)"}}>
                                <i className="bx bx-briefcase" style={{marginRight: 5}}/>
                                {specialist.profile.experience} лет опыта
                            </span>
                            <span style={{fontSize: "0.76rem", color: "var(--dash-muted)"}}>
                                <i className="bx bx-area" style={{marginRight: 5}}/>
                                {specialist.profile.sqm} м² реализовано
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowProfile(true)}
                        style={{
                            border: "1px solid var(--dash-border)",
                            borderRadius: 8,
                            padding: "7px 12px",
                            background: "transparent",
                            color: "var(--dash-text)",
                            font: "inherit",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "100%",
                        }}
                    >
                        Профиль и портфолио
                    </button>
                </>
            )}
        </div>
        {showProfile && specialist.profile && (
            <DesignerProfileModal designer={specialist.profile} onClose={() => setShowProfile(false)}/>
        )}
        </>
    )
}
