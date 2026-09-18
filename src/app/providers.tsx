"use client"

import {SessionProvider} from "next-auth/react"
import {TooltipProvider} from "@/components/ui/tooltip"
import {Toaster} from "@/components/ui/sonner"
import {DialogHost} from "@/components/ui/confirm-dialog"

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <TooltipProvider>
                {children}
                <Toaster richColors position="top-right" offset={{top: 72}}/>
                <DialogHost/>
            </TooltipProvider>
        </SessionProvider>
    )
}
