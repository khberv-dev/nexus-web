import Link from "next/link"

interface BreadcrumbItem {
  href: string
  label: string
}

export function DashboardBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="breadcrumb">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return isLast ? (
            <li key={item.href} className="breadcrumb-item active">{item.label}</li>
          ) : (
            <li key={item.href} className="breadcrumb-item">
              <Link href={item.href}>{item.label}</Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
