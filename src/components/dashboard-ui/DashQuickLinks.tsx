"use client"

import Link from "next/link"

type QuickLinkItem = {
  href: string
  label: string
  sub: string
  icon: string
  h1: number
  h2: number
}

export function DashQuickLinks({
  title,
  items,
}: {
  title: string
  items: QuickLinkItem[]
}) {
  return (
    <div className="dash-discover">
      <div className="dash-discover-heading-wrap">
        <h3 className="dash-section-heading">{title}</h3>
      </div>
      <ul className="dash-discover-places">
        {items.map(link => (
          <li key={link.href} className="dash-discover__place">
            <Link href={link.href} className="dash-discover__place-link">
              <h4 className="dash-discover__place-heading">{link.label}</h4>
              <p className="dash-discover__place-sub">{link.sub}</p>
              <div className="dash-discover__more">
                <div
                  className="dash-discover__more-icon"
                  style={{ background: `linear-gradient(20deg, hsl(${link.h1},72%,52%), hsl(${link.h2},72%,44%))` }}
                >
                  <i className={`bx ${link.icon}`} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
