"use client"

import "@/components/Community/Community.css"

type Props = {
  /** `dash` — внутри `.dash` (переменные темы). `dark` — анкета на темном фоне без оболочки dash */
  variant?: "dash" | "dark"
}

export function ClientDashFooter({ variant = "dash" }: Props) {
  if (variant === "dark") {
    return (
      <footer className="client-lk-footer client-lk-footer--dark">
        <p className="client-lk-footer__copy">NEXUS &copy; 2026</p>
      </footer>
    )
  }
  return (
    <footer className="dash-footer">
      <p className="dash-footer__copy">NEXUS &copy; 2026</p>
    </footer>
  )
}
