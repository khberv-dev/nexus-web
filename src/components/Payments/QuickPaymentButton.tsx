"use client"

import { useState } from "react"
import { isStagePaymentsDisabledPublic } from "@/lib/payments/flags"

interface QuickPaymentButtonProps {
  invoiceId: string
  amount: number
  orderId: string
  description?: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function QuickPaymentButton({
  invoiceId,
  amount,
  orderId,
  description,
  onSuccess,
  onError,
}: QuickPaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const skipPayments = isStagePaymentsDisabledPublic()

  const handlePayment = async () => {
    setLoading(true)
    try {
      if (skipPayments) {
        // Call init anyway: in billing-disabled mode it unlocks the stage.
        const res = await fetch("/api/payments/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: invoiceId, amount }),
        })
        if (!res.ok) throw new Error("Не удалось продолжить без оплаты")
        onSuccess?.()
        setLoading(false)
        setShowConfirm(false)
        return
      }
      // Инициализируем платеж через API
      const res = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: invoiceId,
          amount,
        }),
      })

      if (!res.ok) {
        throw new Error("Ошибка инициализации платежа")
      }

      const { paymentUrl } = await res.json()

      // Перенаправляем на платежную форму T-Bank
      if (paymentUrl) {
        window.location.href = paymentUrl
      } else {
        throw new Error("Платежный URL не получен")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка"
      onError?.(message)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5em",
          padding: "0.6em 1.2em",
          borderRadius: 6,
          border: "none",
          background: "#059669",
          color: "white",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "background 0.2s ease",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.background = "#047857"
        }}
        onMouseLeave={(e) => {
          if (!loading) e.currentTarget.style.background = "#059669"
        }}
      >
        <i className="bx bx-credit-card" style={{ fontSize: "1em" }} />
        <span>{loading ? "Обработка..." : skipPayments ? "Продолжить без оплаты" : "Оплатить картой"}</span>
      </button>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !loading && setShowConfirm(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "#1f2937" }}>
              Подтверждение платежа
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#6b7280" }}>
              {description || `Вы собираетесь оплатить счет за проект #${orderId}`}
            </p>
            <div
              style={{
                background: "#f3f4f6",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                Сумма к оплате:
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#1f2937" }}>
                {Math.round(amount / 1000)}k ₽
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = "#f9fafb"
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = "white"
                }}
              >
                Отменить
              </button>
              <button
                onClick={handlePayment}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#059669",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  transition: "background 0.2s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = "#047857"
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = "#059669"
                }}
              >
                {loading ? "Обработка..." : "Оплатить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
