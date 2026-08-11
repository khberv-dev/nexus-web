"use client"

import {signIn} from "next-auth/react"
import {AUTH_CALLBACK, type LoginRole, PANEL_W, ROLE_GAP, ROLE_H, ROLES,} from "./constants"
import {sideBtnStyle} from "./styles"

type Props = {
    selected: LoginRole | null
    setSelected: (r: LoginRole | null) => void
    mobile: boolean
    openAuth: () => void
    openReg: () => void
    zitadelEnabled: boolean
}

export function LoginRoleBoard({
                                   selected,
                                   setSelected,
                                   mobile,
                                   openAuth,
                                   openReg,
                                   zitadelEnabled,
                               }: Props) {
    const selectedIndex = selected ? ROLES.findIndex((r) => r.role === selected) : -1
    const panelTop = selectedIndex >= 0 ? selectedIndex * (ROLE_H + ROLE_GAP) : 0
    const showSide = selected === "SPECIALIST" || selected === "CLIENT" || selected === "ADMIN"
    const roleBtnW = mobile ? "100%" : 260
    const roleBtnMinH = mobile ? 76 : ROLE_H

    return (
        <div
            style={{
                display: "flex",
                gap: mobile ? 16 : 12,
                alignItems: "flex-start",
                flexDirection: mobile ? "column" : "row",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ROLE_GAP,
                    flexShrink: 0,
                    width: roleBtnW,
                }}
            >
                {ROLES.map(({role, label, desc}) => {
                    const isActive = selected === role
                    return (
                        <button
                            key={role}
                            type="button"
                            onClick={() => setSelected(isActive ? null : role)}
                            style={{
                                width: roleBtnW,
                                minHeight: roleBtnMinH,
                                background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                                border: `1px solid ${isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.14)"}`,
                                borderRadius: 12,
                                color: "#f4f4f4",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: mobile ? "0.9rem 1.1rem" : "0 1.25em",
                                transition: "background 0.2s, border-color 0.2s",
                                fontFamily: "inherit",
                                textAlign: "left",
                                WebkitTapHighlightColor: "transparent",
                            }}
                        >
                            <div>
                                <div style={{fontSize: mobile ? "1.05rem" : "1rem", fontWeight: 500}}>{label}</div>
                                <div
                                    style={{
                                        fontSize: mobile ? "0.84rem" : "0.8rem",
                                        color: "rgba(255,255,255,0.48)",
                                        marginTop: 4,
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {desc}
                                </div>
                            </div>
                            <span style={{color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)"}}>
                {isActive ? "✓" : "→"}
              </span>
                        </button>
                    )
                })}
            </div>

            <div
                style={{
                    position: mobile ? "static" : "relative",
                    flex: mobile ? "unset" : 1,
                    width: mobile ? "100%" : "auto",
                    minHeight: mobile ? undefined : ROLE_H * 3 + ROLE_GAP * 2,
                }}
            >
                {showSide && (
                    <div
                        style={{
                            position: mobile ? "static" : "absolute",
                            top: mobile ? undefined : panelTop,
                            left: 0,
                            width: mobile ? "100%" : PANEL_W,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0,
                            opacity: selected ? 1 : 0,
                            pointerEvents: selected ? "auto" : "none",
                            transition: mobile ? "opacity 0.2s" : "top 0.2s ease, opacity 0.2s",
                            marginTop: mobile && selected ? 4 : 0,
                        }}
                    >
                        {selected === "ADMIN" && (
                            <button type="button" onClick={openAuth} style={sideBtnStyle(mobile, "default")}>
                                Войти по email
                            </button>
                        )}
                        {(selected === "SPECIALIST" || selected === "CLIENT") && (
                            <>
                                <button type="button" onClick={openAuth} style={sideBtnStyle(mobile, "primary")}>
                                    Войти по email
                                </button>
                                <button type="button" onClick={openReg} style={sideBtnStyle(mobile, "dim")}>
                                    Регистрация
                                </button>
                            </>
                        )}
                        {zitadelEnabled && (
                            <button
                                type="button"
                                onClick={() => void signIn("zitadel", {callbackUrl: AUTH_CALLBACK})}
                                style={{
                                    ...sideBtnStyle(mobile, "dim"),
                                    marginTop: 4,
                                    marginBottom: 0,
                                    fontWeight: 500,
                                    fontSize: "0.8rem",
                                    opacity: 0.9,
                                }}
                            >
                                Войти через Zitadel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
