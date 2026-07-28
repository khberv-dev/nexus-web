import type { ReactNode } from "react"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/sneat/core.css" />
      <link rel="stylesheet" href="/sneat/demo.css" />
      <link rel="stylesheet" href="/sneat/fonts/iconify-icons.css" />
      <style>{`
        body { margin: 0; overflow: hidden; }

        :root {
          --bs-font-sans-serif: var(--font-inter), 'Inter', -apple-system, sans-serif;
          --bs-body-font-family: var(--font-inter), 'Inter', -apple-system, sans-serif;
          --bs-primary: #6366f1;
          --bs-primary-rgb: 99,102,241;
          --bs-primary-text-emphasis: #4f46e5;
          --bs-primary-bg-subtle: #eef2ff;
          --bs-primary-border-subtle: rgba(99,102,241,0.2);
          --bs-link-color: #6366f1;
        }

        h1,h2,h3,h4,h5,h6,.card-title {
          font-family: 'PP Neue Montreal', var(--font-inter), 'Inter', sans-serif;
          font-weight: 500;
        }

        /* ── Dark mode: Bootstrap component overrides ── */
        @media (prefers-color-scheme: dark) {
          /* Cards */
          .card {
            --bs-card-bg: #1e293b;
            --bs-card-border-color: #334155;
            --bs-card-color: #e2e8f0;
            background-color: #1e293b !important;
            border-color: #334155 !important;
            color: #e2e8f0;
          }
          .card-header {
            background-color: #263348 !important;
            border-bottom-color: #334155 !important;
            color: #e2e8f0;
          }
          .card-body { color: #e2e8f0; }

          /* Tables */
          .table {
            --bs-table-bg: transparent;
            --bs-table-color: #e2e8f0;
            --bs-table-border-color: #334155;
            color: #e2e8f0;
          }
          .table thead th {
            color: #94a3b8;
            border-bottom-color: #334155;
          }
          .table td { border-bottom-color: #334155; }
          .table-hover > tbody > tr:hover > td { background-color: rgba(255,255,255,0.04); }

          /* Form controls */
          .form-control, .form-select {
            background-color: #1e293b;
            border-color: #475569;
            color: #e2e8f0;
          }
          .form-control:focus, .form-select:focus {
            background-color: #263348;
            border-color: #818cf8;
            color: #f1f5f9;
            box-shadow: 0 0 0 0.2rem rgba(99,102,241,0.25);
          }
          .form-control::placeholder { color: #64748b; }
          textarea.form-control { background-color: #1e293b; color: #e2e8f0; }

          /* Borders */
          .border, .border-bottom, .border-top { border-color: #334155 !important; }
          .rounded, .border-bottom { border-color: #334155; }

          /* Text utilities */
          .text-muted { color: #94a3b8 !important; }
          .text-dark  { color: #e2e8f0 !important; }
          .fw-semibold, .fw-medium, .fw-bold { color: #f1f5f9; }

          /* Buttons */
          .btn-outline-secondary {
            color: #94a3b8;
            border-color: #475569;
          }
          .btn-outline-secondary:hover {
            background-color: #334155;
            border-color: #64748b;
            color: #e2e8f0;
          }

          /* Badges */
          .bg-label-secondary { background-color: rgba(255,255,255,0.07) !important; color: #cbd5e1 !important; }
          .bg-label-primary   { background-color: rgba(99,102,241,0.18) !important; color: #818cf8 !important; }
          .bg-label-warning   { background-color: rgba(245,158,11,0.18) !important; color: #fbbf24 !important; }
          .bg-label-danger    { background-color: rgba(239,68,68,0.18) !important;  color: #f87171 !important; }
          .bg-label-success   { background-color: rgba(34,197,94,0.18) !important;  color: #4ade80 !important; }
          .bg-label-info      { background-color: rgba(14,165,233,0.18) !important; color: #38bdf8 !important; }

          /* Alert */
          .alert-warning { background-color: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.25); color: #fbbf24; }

          /* Split panel list bg */
          [style*="background: #fafafa"] { background: #141e30 !important; }
        }
      `}</style>
      {children}
    </>
  )
}
