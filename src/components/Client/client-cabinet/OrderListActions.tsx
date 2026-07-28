"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function HelpButton({
  orderId,
  briefData,
  alreadyRequested,
  className,
  onRequested,
  disabled: disabledProp,
}: {
  orderId: string
  briefData: Record<string, string>
  alreadyRequested: boolean
  className?: string
  onRequested?: () => void
  /** Например, пока не подписан договор оказания услуг — сохранение брифа недоступно. */
  disabled?: boolean
}) {
  const [done, setDone] = useState(alreadyRequested)
  const [confirming, setConfirming] = useState(false)
  const onClick = async () => {
    if (done) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDone(true)
    try {
      await fetch(`/api/orders/${orderId}/brief`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...briefData, _briefHelpRequested: true }),
      })
      onRequested?.()
    } catch {
      setDone(false)
    } finally {
      setConfirming(false)
    }
  }
  const disabled = Boolean(disabledProp) || done

  return (
    <button
      type="button"
      onClick={onClick}
      onBlur={() => setConfirming(false)}
      disabled={disabled}
      title={
        disabledProp
          ? "Сначала подпишите договор оказания услуг во вкладке «Оплата»"
          : done
            ? "Запрос уже отправлен"
            : confirming
              ? "Нажмите еще раз для подтверждения"
              : "Отправить запрос на помощь менеджера"
      }
      className={[
        "dash-inline-action",
        "dash-inline-action--help",
        done ? "is-done" : "",
        confirming ? "is-confirming" : "",
        className ?? "",
      ].join(" ").trim()}
    >
      {done ? (
        <>
          <i className="bx bx-check" />
        </>
      ) : confirming ? (
        <>
          <i className="bx bx-error" style={{ marginRight: 4 }} />
          Подтвердить запрос
        </>
      ) : (
        <>
          <i className="bx bx-help-circle" style={{ marginRight: 4 }} />
          Нужна помощь менеджера
        </>
      )}
    </button>
  )
}

export function DeleteButton({
  orderId,
  onDeleted,
  className,
}: {
  orderId: string
  /** Дополнительно к обновлению данных страницы (router.refresh). */
  onDeleted?: () => void
  className?: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const onClick = async () => {
    if (deleting) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error ?? "Не удалось удалить черновик")
        return
      }
      onDeleted?.()
      router.refresh()
    } catch {
      alert("Ошибка сети при удалении черновика")
    } finally {
      setDeleting(false)
    }
  }
  return (
    <button
      onClick={onClick}
      onBlur={() => { if (!deleting) setConfirming(false) }}
      disabled={deleting}
      className={["dash-inline-action", "dash-inline-action--delete", confirming ? "is-confirming" : "", className ?? ""].join(" ").trim()}
    >
      <i className={`bx ${deleting ? "bx-loader-circle" : confirming ? "bx-check" : "bx-trash"}`} style={{ marginRight: 3 }} />
      {deleting ? "Удаление..." : confirming ? "Точно?" : "Удалить"}
    </button>
  )
}
