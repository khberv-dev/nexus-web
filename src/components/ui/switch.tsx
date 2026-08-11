"use client"

import * as React from "react"
import {cn} from "@/lib/utils"

function Switch({className, ...props}: React.ComponentProps<"input">) {
    return (
        <div className={cn("relative inline-flex items-center cursor-pointer", className)}>
            <input type="checkbox" className="sr-only peer" {...props} />
            <div
                className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
        </div>
    )
}

Switch.displayName = "Switch"

export {Switch}
