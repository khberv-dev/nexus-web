"use client"

import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,} from "react"
import {useRouter} from "next/navigation"

type RefreshHandler = () => void | Promise<void>

type AdminRefreshContextValue = {
    register: (fn: RefreshHandler) => void
    unregister: () => void
    runRefresh: () => Promise<void>
    refreshing: boolean
}

const AdminRefreshContext = createContext<AdminRefreshContextValue | null>(null)

export function AdminRefreshProvider({children}: { children: ReactNode }) {
    const router = useRouter()
    const handlerRef = useRef<RefreshHandler | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const lastUnreadRef = useRef<number | null>(null)

    const register = useCallback((fn: RefreshHandler) => {
        handlerRef.current = fn
    }, [])

    const unregister = useCallback(() => {
        handlerRef.current = null
    }, [])

    const runRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            if (handlerRef.current) await handlerRef.current()
            else router.refresh()
        } finally {
            setRefreshing(false)
        }
    }, [router])

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

    const value = useMemo(
        () => ({register, unregister, runRefresh, refreshing}),
        [register, unregister, runRefresh, refreshing]
    )

    return <AdminRefreshContext.Provider value={value}>{children}</AdminRefreshContext.Provider>
}

/** Регистрирует функцию загрузки данных страницы для общей кнопки «Обновить» в шапке админки. */
export function useRegisterAdminRefresh(load: RefreshHandler) {
    const ctx = useContext(AdminRefreshContext)
    useEffect(() => {
        if (!ctx) return
        ctx.register(load)
        return () => ctx.unregister()
    }, [ctx, load])
}

export function useAdminRefreshControls(): AdminRefreshContextValue {
    const ctx = useContext(AdminRefreshContext)
    if (!ctx) throw new Error("useAdminRefreshControls must be used within AdminRefreshProvider")
    return ctx
}
