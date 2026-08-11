"use client"

import type {Designer} from "./types"

interface ProfileBodyProps {
    designer: Designer
    works: string[]
    onOpenWork: (index: number) => void
}

export function ProfileBody({designer: d, works, onOpenWork}: ProfileBodyProps) {
    return (
        <>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px 24px",
                    marginBottom: 20,
                    paddingBottom: 20,
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
            >
                {[
                    {label: "Опыт", value: `${d.experience} лет`},
                    {label: "Реализовано", value: `${d.sqm} м²`},
                    {label: "Стиль", value: d.style},
                    {label: "3D моделирование", value: d.has3d ? "Да" : "Нет"},
                    {label: "Чертежи", value: d.hasRd ? "Да" : "Нет"},
                ].map(item => (
                    <div key={item.label} style={{minWidth: 100}}>
                        <p style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.7rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            margin: "0 0 4px"
                        }}>
                            {item.label}
                        </p>
                        <span style={{color: "#f4f4f4", fontWeight: 600, fontSize: "0.9rem"}}>{item.value}</span>
                    </div>
                ))}
            </div>

            {d.bio && (
                <div style={{marginBottom: 24}}>
                    <p style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        margin: "0 0 10px"
                    }}>
                        О себе
                    </p>
                    <p style={{
                        color: "rgba(255,255,255,0.75)",
                        fontSize: "0.9rem",
                        lineHeight: 1.65,
                        margin: 0
                    }}>{d.bio}</p>
                </div>
            )}

            {works.length > 0 && (
                <div>
                    <p style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        margin: "0 0 10px"
                    }}>
                        Работы
                    </p>
                    <div style={{display: "grid", gridTemplateColumns: `repeat(${works.length}, 1fr)`, gap: 8}}>
                        {works.map((src, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => onOpenWork(i)}
                                aria-label={`Открыть работу ${i + 1}`}
                                style={{
                                    aspectRatio: "4/3",
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    padding: 0,
                                    cursor: "pointer",
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={`Работа ${i + 1}`}
                                     style={{width: "100%", height: "100%", objectFit: "cover", display: "block"}}/>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}
