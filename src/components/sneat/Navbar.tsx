"use client"
import Link from "next/link"

export default function Navbar() {
  return (
    <nav className="layout-navbar container-xxl navbar navbar-expand-xl navbar-detached align-items-center bg-navbar-theme">
      <div className="layout-menu-toggle navbar-nav align-items-xl-center me-3 me-xl-0 d-xl-none">
        <a className="nav-item nav-link px-0 me-xl-4" href="#">
          <i className="bx bx-menu bx-md" />
        </a>
      </div>

      <div className="navbar-nav-right d-flex align-items-center" id="navbar-collapse">
        <ul className="navbar-nav flex-row align-items-center ms-auto">
          <li className="nav-item">
            <Link href="/work/profile" className="nav-link">
              <div className="avatar avatar-online">
                <img src="/sneat/img/avatars/1.png" alt="avatar" className="rounded-circle" />
              </div>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}
