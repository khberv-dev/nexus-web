"use client"

import {useEffect, useState} from "react"
import {Icon} from "@/components/ui/icon"
import type {IconName} from "@/lib/icon-map"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {cn} from "@/lib/utils"
import {type DialogRequest, type DialogVariant, registerDialogListener} from "@/lib/dialog-store"

/**
 * Единственный смонтированный хост для confirmDialog()/promptDialog() (см. src/lib/dialog-store.ts) —
 * подключён один раз в Providers, как и <Toaster/>. Запросы копятся в очереди на случай, если
 * следующий confirm/prompt вызовут раньше, чем закроется текущий.
 */
export function DialogHost() {
    const [queue, setQueue] = useState<DialogRequest[]>([])

    useEffect(() => {
        registerDialogListener((request) => setQueue((q) => [...q, request]))
        return () => registerDialogListener(null)
    }, [])

    const current = queue[0] ?? null
    const advance = () => setQueue((q) => q.slice(1))

    if (!current) return null

    if (current.kind === "confirm") {
        const {options, resolve} = current
        const respond = (value: boolean) => {
            resolve(value)
            advance()
        }
        const accent = ACCENTS[options.variant ?? "default"]
        return (
            <Dialog open onOpenChange={(open) => !open && respond(false)}>
                <DialogContent
                    showCloseButton={!accent}
                    className={cn("dialog-surface gap-0 overflow-hidden p-0", !accent && "gap-4 p-4")}
                >
                    <DialogAccentHead accent={accent} title={options.title} description={options.description}/>
                    <DialogFooter className={cn(accent && "mx-0 mb-0 rounded-t-none bg-transparent p-4")}>
                        <Button size="sm" variant="outline" onClick={() => respond(false)}>
                            {options.cancelLabel ?? "Отмена"}
                        </Button>
                        <Button
                            size="sm"
                            className={accent?.solidButton}
                            variant={!accent && options.variant === "destructive" ? "destructive" : "default"}
                            onClick={() => respond(true)}
                        >
                            {options.confirmLabel ?? "Да"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return <PromptDialogBody request={current} onDone={advance}/>
}

function PromptDialogBody({request, onDone}: { request: Extract<DialogRequest, { kind: "prompt" }>; onDone: () => void }) {
    const {options, resolve} = request
    const [value, setValue] = useState(options.defaultValue ?? "")
    const accent = ACCENTS[options.variant ?? "default"]

    const respond = (result: string | null) => {
        resolve(result)
        onDone()
    }

    return (
        <Dialog open onOpenChange={(open) => !open && respond(null)}>
            <DialogContent
                showCloseButton={!accent}
                className={cn("dialog-surface gap-0 overflow-hidden p-0", !accent && "gap-4 p-4")}
            >
                <DialogAccentHead accent={accent} title={options.title} description={options.description}/>
                <div className={cn(accent && "p-4")}>
                    {options.multiline ? (
                        <Textarea
                            autoFocus
                            value={value}
                            placeholder={options.placeholder}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    ) : (
                        <Input
                            autoFocus
                            value={value}
                            placeholder={options.placeholder}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    respond(value)
                                }
                            }}
                        />
                    )}
                </div>
                <DialogFooter className={cn(accent && "mx-0 mb-0 rounded-t-none bg-transparent p-4")}>
                    <Button size="sm" variant="outline" onClick={() => respond(null)}>
                        {options.cancelLabel ?? "Отмена"}
                    </Button>
                    <Button size="sm" className={accent?.solidButton} onClick={() => respond(value)}>
                        {options.confirmLabel ?? "ОК"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

type Accent = {
    band: string
    icon: string
    title: string
    solidButton: string
    iconName: IconName
}

/** default — обычный нейтральный заголовок без цветной шапки (не всякий confirm() — предупреждение). */
const ACCENTS: Record<DialogVariant, Accent | null> = {
    default: null,
    warning: {
        band: "bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/15",
        icon: "text-amber-500",
        title: "text-amber-600 dark:text-amber-400",
        solidButton: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        iconName: "error",
    },
    success: {
        band: "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/15",
        icon: "text-emerald-500",
        title: "text-emerald-600 dark:text-emerald-400",
        solidButton: "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
        iconName: "check-circle",
    },
    destructive: {
        band: "bg-red-500/10 border-red-500/30 dark:bg-red-500/15",
        icon: "text-red-500",
        title: "text-red-600 dark:text-red-400",
        solidButton: "border-transparent bg-red-500 text-white hover:bg-red-600",
        iconName: "error",
    },
}

function DialogAccentHead({accent, title, description}: { accent: Accent | null; title: string; description?: string }) {
    if (!accent) {
        return (
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
        )
    }
    return (
        <div className={cn("flex items-start gap-3 border-b p-4", accent.band)}>
            <Icon name={accent.iconName} className={cn("mt-0.5 size-5 shrink-0", accent.icon)}/>
            <div>
                <DialogTitle className={cn("text-[0.95rem] font-semibold", accent.title)}>{title}</DialogTitle>
                {description && (
                    <DialogDescription className="mt-1 text-[0.8rem]">{description}</DialogDescription>
                )}
            </div>
        </div>
    )
}
