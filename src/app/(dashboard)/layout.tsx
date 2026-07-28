import type { ReactNode } from "react"

export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/sneat/core.css" />
      <link rel="stylesheet" href="/sneat/demo.css" />
      <link rel="stylesheet" href="/sneat/fonts/iconify-icons.css" />
      {/* Переопределяем Bootstrap font — убираем Public Sans, используем Inter */}
      <style>{`
        :root {
          /* Шрифт */
          --bs-font-sans-serif: var(--font-inter), 'Inter', -apple-system, sans-serif;
          --bs-body-font-family: var(--font-inter), 'Inter', -apple-system, sans-serif;

          /* NEXUS brand */
          --nexus-accent: #201d1d;
          --nexus-accent-light: rgba(32, 29, 29, 0.07);
          --nexus-accent-border: rgba(32, 29, 29, 0.18);

          /* Bootstrap primary → NEXUS dark */
          --bs-primary: #201d1d;
          --bs-primary-rgb: 32, 29, 29;
          --bs-primary-text-emphasis: #201d1d;
          --bs-primary-bg-subtle: #f0efee;
          --bs-primary-border-subtle: rgba(32,29,29,0.2);
          --bs-link-color: #201d1d;
          --bs-link-hover-color: #403a3a;
        }
        body { font-family: var(--font-inter), 'Inter', -apple-system, sans-serif; }

        /* Heading font — PP Neue Montreal */
        h1, h2, h3, h4, h5, h6, .card-title {
          font-family: 'PP Neue Montreal', var(--font-inter), 'Inter', sans-serif;
          font-weight: 500;
        }
      `}</style>
      <div className="layout-wrapper layout-content-navbar">
        {children}
      </div>
    </>
  )
}
