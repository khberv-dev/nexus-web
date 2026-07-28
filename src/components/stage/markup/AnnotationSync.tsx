import React, { useEffect, useRef, useState, type MutableRefObject } from "react"
import { useAnnotator } from "@annotorious/react"
import type { AnnotoriousImageAnnotator, ImageAnnotation } from "@annotorious/react"
import type { MarkupToastVariant } from "./types"

/**
 * Загрузка пометок с сервера + автосохранение (debounce), чтобы F5 не обнулял черновик
 * до явного «Сохранить пометки».
 */
export function AnnotationSync({
  stageId,
  fileId,
  editable,
  showToast,
  lastSavedJsonRef,
  onStatus,
}: {
  stageId: string
  fileId: string
  editable: boolean
  showToast: (message: string, variant: MarkupToastVariant) => void
  lastSavedJsonRef: MutableRefObject<string | null>
  onStatus?: (s: {
    fetchState: "idle" | "loading" | "ok" | "error"
    fetchedCount?: number
    appliedCount?: number
    lastError?: string
    lastAppliedSig?: string
  }) => void
}) {
  const anno = useAnnotator<AnnotoriousImageAnnotator>()
  const annoRef = useRef<AnnotoriousImageAnnotator | null>(null)
  useEffect(() => {
    annoRef.current = anno ?? null
  }, [anno])
  const annotatorReady = anno != null

  const [remote, setRemote] = useState<unknown[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedRemoteSigRef = useRef<string>("__none__")
  /** Пока картинка в режиме превью, аннотатора нет — fetch уже вернул remote; после появления Annotorious нужно снова применить пометки. */
  const prevAnnotatorReadyRef = useRef(false)

  useEffect(() => {
    if (annotatorReady && !prevAnnotatorReadyRef.current) {
      appliedRemoteSigRef.current = "__none__"
    }
    prevAnnotatorReadyRef.current = annotatorReady
  }, [annotatorReady])

  useEffect(() => {
    appliedRemoteSigRef.current = "__none__"
    let cancelled = false
    onStatus?.({ fetchState: "loading" })
    fetch(`/api/stages/${stageId}/files/${fileId}/annotations`, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ annotations?: unknown[] }>
      })
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d.annotations) ? d.annotations : []
        setRemote(list)
        onStatus?.({ fetchState: "ok", fetchedCount: list.length })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setRemote([])
        onStatus?.({
          fetchState: "error",
          fetchedCount: 0,
          lastError: e instanceof Error ? e.message : String(e),
        })
      })
    return () => {
      cancelled = true
    }
  }, [stageId, fileId])

  const remoteSig = remote === null ? "" : JSON.stringify(remote)

  // Не вешаемся на identity `anno` — после setAnnotations контекст часто перерисовывается и ломает img.
  useEffect(() => {
    if (!annotatorReady || remote === null) return
    if (appliedRemoteSigRef.current === remoteSig) return

    let cancelled = false
    const list = remote as ImageAnnotation[]
    const sig = remoteSig

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        const a = annoRef.current
        if (!a) return
        const apply = () => {
          try {
            // Без replace: true — иначе на части состояний Annotorious сбрасывает привязку к изображению.
            a.setAnnotations(list)
          } catch {
            try {
              a.setAnnotations(list)
            } catch {
              /* ignore */
            }
          }
        }
        apply()
        // Движок иногда ещё не прикреплён к новому img после превью — повтор через кадр подтягивает метки.
        if (list.length > 0) {
          requestAnimationFrame(() => {
            if (cancelled) return
            try {
              const cur = annoRef.current?.getAnnotations() ?? []
              if (cur.length < list.length) apply()
            } catch {
              apply()
            }
          })
        }
        try {
          lastSavedJsonRef.current = JSON.stringify(a.getAnnotations())
        } catch {
          lastSavedJsonRef.current = sig
        }
        appliedRemoteSigRef.current = sig
        try {
          const applied = a.getAnnotations()?.length ?? 0
          onStatus?.({ fetchState: "ok", appliedCount: applied, lastAppliedSig: sig })
        } catch {
          onStatus?.({ fetchState: "ok", appliedCount: list.length, lastAppliedSig: sig })
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [annotatorReady, remote, remoteSig, lastSavedJsonRef])

  useEffect(() => {
    if (!annotatorReady || !editable) return

    const pushServer = async () => {
      const a = annoRef.current
      if (!a) return
      let list: ImageAnnotation[]
      try {
        list = a.getAnnotations()
      } catch {
        return
      }
      let json: string
      try {
        json = JSON.stringify(list)
      } catch {
        return
      }
      if (json === lastSavedJsonRef.current) return
      try {
        const r = await fetch(`/api/stages/${stageId}/files/${fileId}/annotations`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotations: list }),
        })
        if (r.ok) lastSavedJsonRef.current = json
        else if (r.status !== 409) showToast("Не удалось автосохранить пометки", "error")
      } catch {
        showToast("Не удалось автосохранить пометки", "error")
      }
    }

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(pushServer, 1200)
    }

    const flushPending = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
        void pushServer()
      }
    }

    const a = annoRef.current
    if (!a) return

    a.on("createAnnotation", schedule)
    a.on("updateAnnotation", schedule)
    a.on("deleteAnnotation", schedule)

    const onHide = () => {
      if (document.visibilityState === "hidden") flushPending()
    }
    window.addEventListener("pagehide", flushPending)
    document.addEventListener("visibilitychange", onHide)

    return () => {
      window.removeEventListener("pagehide", flushPending)
      document.removeEventListener("visibilitychange", onHide)
      flushPending()
      const cur = annoRef.current
      if (cur) {
        cur.off("createAnnotation", schedule)
        cur.off("updateAnnotation", schedule)
        cur.off("deleteAnnotation", schedule)
      }
    }
  }, [annotatorReady, editable, stageId, fileId, showToast, lastSavedJsonRef])

  return null
}

