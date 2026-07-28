"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export function DashboardHeader({
  userName,
  userEmail,
}: {
  title?: string
  userName?: string
  userEmail?: string
}) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const initials = (userName ?? userEmail ?? "?")[0].toUpperCase()

  useEffect(() => {
    fetch("/api/files?category=AVATAR")
      .then(r => r.ok ? r.json() : [])
      .then(async (files: { id: string }[]) => {
        if (!files.length) return
        const res = await fetch(`/api/files/${files[0].id}/url`)
        if (res.ok) {
          const { url } = await res.json()
          setAvatarUrl(url)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <nav
      className="layout-navbar container-xxl navbar-detached navbar navbar-expand-xl align-items-center bg-navbar-theme"
      id="layout-navbar"
    >
      <div className="layout-menu-toggle navbar-nav align-items-xl-center me-4 me-xl-0 d-xl-none">
        <a className="nav-item nav-link px-0 me-xl-6" href="#">
          <i className="icon-base bx bx-menu icon-md" />
        </a>
      </div>

      <div className="navbar-nav-right d-flex align-items-center justify-content-end" id="navbar-collapse">
        <ul className="navbar-nav flex-row align-items-center ms-auto">
          <li className={`nav-item navbar-dropdown dropdown-user dropdown${open ? " show" : ""}`}>
            <a
              className="nav-link dropdown-toggle hide-arrow p-0"
              href="#"
              onClick={e => { e.preventDefault(); setOpen(o => !o) }}
            >
              <div className="avatar avatar-online">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt={initials} className="rounded-circle" style={{ width: 40, height: 40, objectFit: "cover" }} />
                ) : (
                  <span
                    className="avatar-initial rounded-circle bg-label-primary"
                    style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}
                  >
                    {initials}
                  </span>
                )}
              </div>
            </a>
            {open && (
              <>
                <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <ul className="dropdown-menu dropdown-menu-end show" style={{ zIndex: 50 }}>
                  <li>
                    <div className="dropdown-item">
                      <div className="d-flex">
                        <div className="flex-grow-1">
                          {userName && <h6 className="mb-0">{userName}</h6>}
                          {userEmail && <small className="text-body-secondary">{userEmail}</small>}
                        </div>
                      </div>
                    </div>
                  </li>
                  <li><div className="dropdown-divider my-1" /></li>
                  <li>
                    <Link className="dropdown-item" href="/work/profile" onClick={() => setOpen(false)}>
                      <i className="icon-base bx bx-user icon-md me-3" />Профиль
                    </Link>
                  </li>
                  <li><div className="dropdown-divider my-1" /></li>
                  <li>
                    <Link className="dropdown-item" href="/api/auth/signout?callbackUrl=/login">
                      <i className="icon-base bx bx-power-off icon-md me-3" />Выйти
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </li>
        </ul>
      </div>
    </nav>
  )
}
