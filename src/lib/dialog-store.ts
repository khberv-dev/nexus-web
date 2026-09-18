"use client"

/**
 * Императивная замена window.confirm()/window.prompt(): любой клиентский код может
 * `await confirmDialog(...)` / `await promptDialog(...)` без хуков — запрос уходит
 * единственному смонтированному <DialogHost/> (см. src/components/ui/confirm-dialog.tsx)
 * через модульный listener, а не через React-контекст.
 */

/** Красит шапку диалога (иконка + фон) под смысл действия — как у sonner-тостов. */
export type DialogVariant = "default" | "warning" | "success" | "destructive"

export type ConfirmDialogOptions = {
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: DialogVariant
}

export type PromptDialogOptions = {
    title: string
    description?: string
    placeholder?: string
    defaultValue?: string
    confirmLabel?: string
    cancelLabel?: string
    multiline?: boolean
    variant?: DialogVariant
}

export type DialogRequest =
    | { kind: "confirm"; options: ConfirmDialogOptions; resolve: (value: boolean) => void }
    | { kind: "prompt"; options: PromptDialogOptions; resolve: (value: string | null) => void }

type Listener = (request: DialogRequest) => void

let listener: Listener | null = null

export function registerDialogListener(fn: Listener | null) {
    listener = fn
}

/** Аналог window.confirm(message): true — подтвердили, false — отменили/закрыли. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
        if (!listener) {
            resolve(false)
            return
        }
        listener({kind: "confirm", options, resolve})
    })
}

/** Аналог window.prompt(message, default): строка — подтвердили (может быть пустой), null — отменили/закрыли. */
export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
        if (!listener) {
            resolve(null)
            return
        }
        listener({kind: "prompt", options, resolve})
    })
}
