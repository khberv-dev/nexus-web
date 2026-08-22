"use client"

import type {ReactNode} from "react"
import {useState} from "react"
import {signOut} from "next-auth/react"
import {ConfirmDialog} from "@/components/Community/ConfirmDialog"

export function SignOutButton({
                                  children,
                                  className,
                                  title = "Выйти",
                                  dataTour,
                                  onOpen,
                              }: {
    children: ReactNode
    className?: string
    title?: string
    dataTour?: string
    onOpen?: () => void
}) {
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const openDialog = () => {
        onOpen?.()
        setConfirmOpen(true)
    }

    const confirmSignOut = async () => {
        if (submitting) return
        setSubmitting(true)
        await signOut({callbackUrl: "/login"})
    }

    return (
        <>
            <button
                type="button"
                className={className}
                title={title}
                data-tour={dataTour}
                onClick={openDialog}
                style={{border: 0, font: "inherit", cursor: "pointer"}}
            >
                {children}
            </button>
            <ConfirmDialog
                open={confirmOpen}
                title="Выйти из аккаунта?"
                message="Для продолжения работы потребуется снова войти в систему."
                confirmLabel={submitting ? "Выходим…" : "Выйти"}
                onConfirm={() => void confirmSignOut()}
                onCancel={() => !submitting && setConfirmOpen(false)}
            />
        </>
    )
}
