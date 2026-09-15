"use client"

import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef} from "react"
import {useRouter} from "next/navigation"

type RefreshHandler = () => void | Promise<void>

type AdminRefreshContextValue = {
    register: (fn: RefreshHandler) => void
    unregister: () => void
}

const AdminRefreshContext = createContext<AdminRefreshContextValue | null>(null)

export function AdminRefreshProvider({children}: { children: ReactNode }) {
    const router = useRouter()
    const handlerRef = useRef<RefreshHandler | null>(null)
    const lastUnreadRef = useRef<number | null>(null)

    const register = useCallback((fn: RefreshHandler) => {
        handlerRef.current = fn
    }, [])

    const unregister = useCallback(() => {
        handlerRef.current = null
    }, [])

    // Auto-refresh: poll notifications, trigger refresh when unread count increases
    useEffect(() => {
        let active = true
        const poll = async () => {
            try {
                const res = await fetch("/api/notifications")
                if (!res.ok || !active) return
                const {unread} = await res.json() as { unread: number }
                if (lastUnreadRef.current !== null && unread > lastUnreadRef.current) {
                    if (handlerRef.current) await handlerRef.current()
                    else router.refresh()
                }
                lastUnreadRef.current = unread
            } catch { /* ignore */
            }
        }
        poll()
        const t = setInterval(poll, 15_000)
        return () => {
            active = false;
            clearInterval(t)
        }
    }, [router])

    const value = useMemo(() => ({register, unregister}), [register, unregister])

    return <AdminRefreshContext.Provider value={value}>{children}</AdminRefreshContext.Provider>
}

/** Регистрирует функцию загрузки данных страницы: её вызывает автообновление при новых уведомлениях. */
export function useRegisterAdminRefresh(load: RefreshHandler) {
    const ctx = useContext(AdminRefreshContext)
    useEffect(() => {
        if (!ctx) return
        ctx.register(load)
        return () => ctx.unregister()
    }, [ctx, load])
}
