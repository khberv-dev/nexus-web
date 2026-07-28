"use client"

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface MediaWithLoaderProps {
  children: ReactNode
  className?: string
  skeletonClassName?: string
}

export function MediaWithLoader({ children, className, skeletonClassName }: MediaWithLoaderProps) {
  const [ready, setReady] = useState(false)

  const markReady = () => setReady(true)

  const content = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        onLoad: (e: unknown) => {
          const el = children as ReactElement<{ onLoad?: (e: unknown) => void }>
          el.props.onLoad?.(e)
          markReady()
        },
        onLoadedData: (e: unknown) => {
          const el = children as ReactElement<{ onLoadedData?: (e: unknown) => void }>
          el.props.onLoadedData?.(e)
          markReady()
        },
        onError: (e: unknown) => {
          const el = children as ReactElement<{ onError?: (e: unknown) => void }>
          el.props.onError?.(e)
          markReady()
        },
      })
    : children

  return (
    <div className={cn("relative h-full w-full", className)}>
      {!ready && (
        <Skeleton
          className={cn("absolute inset-0 rounded-none", skeletonClassName)}
          aria-hidden
        />
      )}
      <div className={cn("h-full w-full transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
        {content}
      </div>
    </div>
  )
}
