import * as React from "react"

import {cn} from "@/lib/utils"

function Checkbox({className, ...props}: React.ComponentProps<"input">) {
    return (
        <input
            type="checkbox"
            data-slot="checkbox"
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 accent-primary",
                className
            )}
            {...props}
        />
    )
}

Checkbox.displayName = "Checkbox"

export {Checkbox}
