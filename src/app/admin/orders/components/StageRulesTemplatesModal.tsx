"use client"

import { useMemo, useRef, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Order, Stage } from "../types"
import { STAGE_LABEL } from "../types"

type Props = {
  open: boolean
  onClose: () => void
  order: Order
  stage: Stage
  onChanged?: () => void
}

type TemplateItem = {
  id: "CONCEPT" | "PLANNING" | "VISUALIZATION" | "SPECIFICATION"
  title: string
  filename: string
}

const TEMPLATES: TemplateItem[] = [
  { id: "CONCEPT", title: "Правила разработки концепции", filename: "Правила разработки концепции.docx" },
  { id: "VISUALIZATION", title: "Правила визуализации", filename: "Правила_визуализация.docx" },
  { id: "PLANNING", title: "Правила план. решения", filename: "Правила_план. решение.docx" },
  { id: "SPECIFICATION", title: "Правила спецификации", filename: "Правила_спецификация.docx" },
]

function humanError(x: unknown) {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : null
  const err = o && typeof o.error === "string" ? o.error : null
  const hint = o && typeof o.hint === "string" ? o.hint : null
  if (err && hint) return `${err} ${hint}`
  if (err) return err
  return "Ошибка"
}

export function StageRulesTemplatesModal({ open, onClose, order, stage, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [currentKey, setCurrentKey] = useState<string | null>(stage.rulesS3Key ?? null)
  const [sentAt, setSentAt] = useState<string | null>(stage.rulesSentAt ?? null)
  const [sentKey, setSentKey] = useState<string | null>(stage.rulesSentS3Key ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageTemplateId = useMemo(() => {
    const map: Record<string, TemplateItem["id"]> = {
      CONCEPT: "CONCEPT",
      PLANNING: "PLANNING",
      VISUALIZATION: "VISUALIZATION",
      SPECIFICATION: "SPECIFICATION",
    }
    return map[String(stage.type)] ?? null
  }, [stage.type])

  const stageTemplate = useMemo(
    () => (stageTemplateId ? TEMPLATES.find((t) => t.id === stageTemplateId) ?? null : null),
    [stageTemplateId],
  )

  const currentEffectiveKey = currentKey ?? stage.rulesS3Key ?? null

  const currentFilename = useMemo(() => {
    const key = currentEffectiveKey
    if (!key) return null
    const seg = key.split("/").pop()
    return seg || key
  }, [currentEffectiveKey])

  const filenameFromKey = (key: string | null) => {
    if (!key) return null
    const seg = key.split("/").pop()
    return seg || key
  }

  const uploadTemplateToStage = async () => {
    if (!stageTemplateId) {
      setError("Для этого этапа нет готового шаблона")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const r = await fetch(
        `/api/admin/stages/${stage.id}/rules?template=1&templateId=${encodeURIComponent(stageTemplateId)}`,
        { method: "POST" },
      )
      if (!r.ok) {
        let body: unknown = null
        try { body = await r.json() } catch { body = null }
        setError(humanError(body))
        return
      }
      let body: unknown = null
      try { body = await r.json() } catch { body = null }
      const payload = body && typeof body === "object" ? (body as { s3Key?: unknown; replacedS3Key?: unknown }) : null
      const nextKey = payload?.s3Key && typeof payload.s3Key === "string" ? payload.s3Key : null
      const prevKey = payload?.replacedS3Key && typeof payload.replacedS3Key === "string" ? payload.replacedS3Key : null
      if (nextKey) setCurrentKey(nextKey)
      const prevName = filenameFromKey(prevKey)
      const nextName = filenameFromKey(nextKey)
      setNotice(prevName && nextName ? `Заменено: ${prevName} → ${nextName}` : nextName ? `Файл прикреплён: ${nextName}` : "Готово")

      // If designer already has a sent version, mark it as outdated.
      if (sentKey && nextKey && sentKey !== nextKey) {
        // keep sentAt/sentKey as-is; UI will show “старая версия”
      }
      onChanged?.()
    } catch {
      setError("Не удалось загрузить шаблон")
    } finally {
      setBusy(false)
    }
  }

  const uploadCustomFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch(`/api/admin/stages/${stage.id}/rules`, { method: "POST", body: fd })
      if (!r.ok) {
        let body: unknown = null
        try { body = await r.json() } catch { body = null }
        setError(humanError(body))
        return
      }
      let body: unknown = null
      try { body = await r.json() } catch { body = null }
      const payload = body && typeof body === "object" ? (body as { s3Key?: unknown; replacedS3Key?: unknown }) : null
      const nextKey = payload?.s3Key && typeof payload.s3Key === "string" ? payload.s3Key : null
      const prevKey = payload?.replacedS3Key && typeof payload.replacedS3Key === "string" ? payload.replacedS3Key : null
      if (nextKey) setCurrentKey(nextKey)
      const prevName = filenameFromKey(prevKey)
      const nextName = filenameFromKey(nextKey)
      setNotice(prevName && nextName ? `Заменено: ${prevName} → ${nextName}` : nextName ? `Файл прикреплён: ${nextName}` : "Готово")

      if (sentKey && nextKey && sentKey !== nextKey) {
        // keep sentAt/sentKey as-is; UI will show “старая версия”
      }
      onChanged?.()
    } catch {
      setError("Не удалось загрузить файл")
    } finally {
      setBusy(false)
    }
  }

  const sendToDesigner = async () => {
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const r = await fetch(`/api/admin/stages/${stage.id}/rules/send`, { method: "POST" })
      if (!r.ok) {
        let body: unknown = null
        try { body = await r.json() } catch { body = null }
        setError(humanError(body))
        return
      }
      let body: unknown = null
      try { body = await r.json() } catch { body = null }
      const payload = body && typeof body === "object" ? (body as { rulesSentAt?: unknown; rulesSentS3Key?: unknown }) : null
      const nextSentAt = payload?.rulesSentAt && typeof payload.rulesSentAt === "string" ? payload.rulesSentAt : null
      const nextSentKey = payload?.rulesSentS3Key && typeof payload.rulesSentS3Key === "string" ? payload.rulesSentS3Key : null
      if (nextSentAt) setSentAt(nextSentAt)
      if (nextSentKey) setSentKey(nextSentKey)
      setNotice(`Отправлено дизайнеру: ${STAGE_LABEL[stage.type]} · ${new Date(nextSentAt ?? Date.now()).toLocaleString("ru-RU")}`)
    } catch {
      setError("Не удалось отправить дизайнеру")
    } finally {
      setSending(false)
    }
  }

  const sentStatus = useMemo(() => {
    if (!sentAt) return { kind: "not_sent" as const }
    const same = sentKey && currentEffectiveKey ? sentKey === currentEffectiveKey : false
    return same
      ? { kind: "sent_current" as const, label: "Размещено у дизайнера", variant: "secondary" as const }
      : { kind: "sent_old" as const, label: "У дизайнера старая версия", variant: "destructive" as const }
  }, [currentEffectiveKey, sentAt, sentKey])

  return (
    <Modal open={open} onClose={onClose} maxWidth={920}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold leading-tight">Правила для дизайнера</div>
            <Badge variant="outline">{STAGE_LABEL[stage.type]}</Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {currentFilename ? (
              <>
                Текущий файл: <span className="font-medium text-foreground">{currentFilename}</span>
              </>
            ) : (
              "Файл ещё не прикреплён"
            )}
          </div>
          {sentStatus.kind !== "not_sent" && sentAt ? (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={sentStatus.variant}>{sentStatus.label}</Badge>
              <span>{new Date(sentAt).toLocaleString("ru-RU")}</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              <Badge variant="outline">Не размещено у дизайнера</Badge>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="text-white border-white/25 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          disabled={busy || sending}
        >
          Закрыть
        </Button>
      </div>

      <div className="max-h-[78vh] overflow-auto p-5">
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">1) Прикрепить правила к этапу</CardTitle>
              <CardDescription>Файл будет сохранён в S3 и станет доступен по ссылке скачивания.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {stageTemplate ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{stageTemplate.title}</div>
                    <div className="text-sm text-muted-foreground">{stageTemplate.filename}</div>
                  </div>
                  <Button onClick={uploadTemplateToStage} disabled={busy || sending}>
                    Прикрепить шаблон
                  </Button>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>Нет готового шаблона</AlertTitle>
                  <AlertDescription>Для этого этапа нет подготовленного документа. Используйте загрузку файла ниже.</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium">Загрузить новый файл (PDF/DOCX)</div>
                  <div className="text-sm text-muted-foreground">Заменит текущий прикреплённый файл.</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={busy || sending}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (!file) return
                    void uploadCustomFile(file)
                  }}
                />
                <Button
                  variant="outline"
                  className="text-white border-white/25 hover:bg-white/10 hover:text-white"
                  type="button"
                  disabled={busy || sending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выбрать файл
                </Button>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Ссылка для дизайнера: <span className="font-medium text-foreground">`/api/stages/{stage.id}/rules`</span>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">2) Разместить у дизайнера</CardTitle>
              <CardDescription>Отправит сообщение дизайнеру и сохранит статус «у дизайнера» для этого шага.</CardDescription>
            </CardHeader>
            <CardContent>
              {sentStatus.kind === "sent_old" ? (
                <Alert variant="destructive">
                  <AlertTitle>У дизайнера старая версия</AlertTitle>
                  <AlertDescription>Вы заменили файл после отправки — нажмите «Отправить дизайнеру», чтобы обновить.</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button onClick={sendToDesigner} disabled={sending || busy || !currentEffectiveKey}>
                Отправить дизайнеру
              </Button>
            </CardFooter>
          </Card>

          {notice ? (
            <Alert>
              <AlertTitle>Готово</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

