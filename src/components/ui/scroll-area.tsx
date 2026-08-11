import * as React from "react"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "@/lib/utils"

const scrollAreaVariants = cva(
    [
        "overflow-y-auto overflow-x-hidden",
        "[scrollbar-width:thin]",
        "[&::-webkit-scrollbar]:w-1",
        "[&::-webkit-scrollbar]:h-1",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
    ].join(" "),
    {
        variants: {
            tone: {
                default: [
                    "[scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_55%,transparent)_transparent]",
                    "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35",
                    "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55",
                ].join(" "),
                dark: [
                    "[scrollbar-color:rgba(255,255,255,0.18)_transparent]",
                    "[&::-webkit-scrollbar-thumb]:bg-white/18",
                    "[&::-webkit-scrollbar-thumb:hover]:bg-white/30",
                ].join(" "),
            },
        },
        defaultVariants: {
            tone: "default",
        },
    },
)

export interface ScrollAreaProps
    extends React.ComponentProps<"div">,
        VariantProps<typeof scrollAreaVariants> {
}

function ScrollArea({className, tone, ...props}: ScrollAreaProps) {
    return (
        <div
            data-slot="scroll-area"
            className={cn(scrollAreaVariants({tone}), className)}
            {...props}
        />
    )
}

export {ScrollArea, scrollAreaVariants}
