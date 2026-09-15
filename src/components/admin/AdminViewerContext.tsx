"use client"

import {createContext, type ReactNode, useContext} from "react"

export type AdminViewer = {
    name: string | null
    email: string
}

const AdminViewerContext = createContext<AdminViewer | null>(null)

/** Текущий администратор: грузится один раз в src/app/admin/layout.tsx, читается шапкой. */
export function AdminViewerProvider({viewer, children}: { viewer: AdminViewer | null; children: ReactNode }) {
    return <AdminViewerContext.Provider value={viewer}>{children}</AdminViewerContext.Provider>
}

export function useAdminViewer(): AdminViewer | null {
    return useContext(AdminViewerContext)
}
