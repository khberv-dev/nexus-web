"use client"

import {useTheme} from "next-themes"
import {Toaster as Sonner, type ToasterProps} from "sonner"
import {Icon} from "@/components/ui/icon"

const Toaster = ({...props}: ToasterProps) => {
    const {theme = "system"} = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group"
            icons={{
                success: (
                    <Icon name="check-circle" className="size-4"/>
                ),
                info: (
                    <Icon name="info-circle" className="size-4"/>
                ),
                warning: (
                    <Icon name="error" className="size-4"/>
                ),
                error: (
                    <Icon name="x-circle" className="size-4"/>
                ),
                loading: (
                    <Icon name="loader-alt" className="size-4 animate-spin"/>
                ),
            }}
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: "cn-toast",
                },
            }}
            {...props}
        />
    )
}

export {Toaster}
