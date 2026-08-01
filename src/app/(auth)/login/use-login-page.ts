"use client"

import { signIn } from "next-auth/react"
import { isValidPhoneNumber } from "react-phone-number-input"
import { useState, useEffect, useCallback } from "react"
import { explainNextAuthEmailError } from "@/lib/auth/email-signin-user-message"
import { AUTH_CALLBACK, MOBILE_MQ, type LoginRole } from "./constants"

export function useLoginPage() {
  const [selected, setSelected] = useState<LoginRole | null>(null)
  const [mobile, setMobile] = useState(false)

  const [authOpen, setAuthOpen] = useState(false)
  const [regOpen, setRegOpen] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const [regForm, setRegForm] = useState<Record<string, string>>({})
  const [specialistDataConsent, setSpecialistDataConsent] = useState(false)
  const [clientDataConsent, setClientDataConsent] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)

  useEffect(() => {
    const mq = globalThis.matchMedia(MOBILE_MQ)
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const closeAuth = useCallback(() => {
    setAuthOpen(false)
    setEmail("")
    setPassword("")
    setError(null)
    setSent(false)
    setLoading(false)
  }, [])

  const closeReg = useCallback(() => {
    setRegOpen(false)
    setRegForm({})
    setSpecialistDataConsent(false)
    setClientDataConsent(false)
    setRegError(null)
    setRegLoading(false)
  }, [])

  const openAuth = useCallback(() => {
    setRegOpen(false)
    setRegForm({})
    setSpecialistDataConsent(false)
    setClientDataConsent(false)
    setRegError(null)
    setEmail("")
    setPassword("")
    setError(null)
    setSent(false)
    setAuthOpen(true)
  }, [])

  const openReg = useCallback(() => {
    setAuthOpen(false)
    setEmail("")
    setPassword("")
    setError(null)
    setSent(false)
    setRegForm({})
    setSpecialistDataConsent(false)
    setClientDataConsent(false)
    setRegError(null)
    setRegOpen(true)
  }, [])

  const sendMagicLinkAuth = useCallback(async () => {
    const e = email.trim().toLowerCase()
    if (!e.includes("@")) {
      setError("Введите корректный email")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const checkRes = await fetch(`/api/auth/pending-signup?email=${encodeURIComponent(e)}`)
      const { exists } = (await checkRes.json()) as { exists: boolean }
      if (!exists) {
        setError("Такого аккаунта ещё нет. Сначала пройдите «Регистрацию» на этой странице.")
        return
      }
      const res = await signIn("email", {
        email: e,
        redirect: false,
        callbackUrl: AUTH_CALLBACK,
      })
      if (res?.error) {
        setError(explainNextAuthEmailError(res.error))
        return
      }
      setSent(true)
    } catch {
      setError("Не удалось отправить запрос. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }, [email, selected])

  const signInWithPassword = useCallback(async () => {
    const e = email.trim().toLowerCase()
    if (!e.includes("@")) {
      setError("Введите корректный email")
      return
    }
    if (!password) {
      setError("Введите пароль")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await signIn("credentials", {
        email: e,
        password,
        redirect: false,
        callbackUrl: AUTH_CALLBACK,
      })
      if (res?.error) {
        setError("Неверный email или пароль")
        return
      }
      globalThis.location.assign(res?.url ?? AUTH_CALLBACK)
    } catch {
      setError("Не удалось выполнить вход. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }, [email, password])

  /** Регистрация: создаёт аккаунт сразу (без письма) и логинит через credentials. Телефон необязателен. */
  const registerAndSignIn = useCallback(
    async (params: { email: string; password: string; role: "CLIENT" | "SPECIALIST"; name: string; phone: string; formData: Record<string, unknown> }) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
        if (res.status === 409 && data?.code === "ALREADY_REGISTERED") {
          return { error: "Вы уже зарегистрированы. Войдите в систему." }
        }
        return { error: data?.error ?? "Не удалось зарегистрироваться. Попробуйте позже." }
      }

      const signInRes = await signIn("credentials", {
        email: params.email,
        password: params.password,
        redirect: false,
        callbackUrl: AUTH_CALLBACK,
      })
      if (signInRes?.error) {
        return { error: "Аккаунт создан, но вход не выполнен. Войдите вручную." }
      }
      globalThis.location.assign(signInRes?.url ?? AUTH_CALLBACK)
      return { error: null }
    },
    []
  )

  const submitClientRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setRegError(null)
      const em = regForm.email?.trim().toLowerCase()
      const fullName = regForm.fullName?.trim()
      const password = regForm.password ?? ""
      if (!em?.includes("@")) {
        setRegError("Введите корректный email")
        return
      }
      if (!fullName) {
        setRegError("Введите ФИО")
        return
      }
      if (password.length < 8) {
        setRegError("Пароль должен быть не короче 8 символов")
        return
      }
      const phone = regForm.phone?.trim() ?? ""
      if (phone && !isValidPhoneNumber(phone)) {
        setRegError("Введите корректный номер телефона")
        return
      }
      if (!clientDataConsent) {
        setRegError("Нужно согласие на обработку персональных данных")
        return
      }
      setRegLoading(true)
      try {
        const { error } = await registerAndSignIn({
          email: em,
          password,
          role: "CLIENT",
          name: fullName,
          phone,
          formData: { fullName, ...(phone ? { phone } : {}), email: em },
        })
        if (error) setRegError(error)
      } catch {
        setRegError("Не удалось зарегистрироваться. Попробуйте позже.")
      } finally {
        setRegLoading(false)
      }
    },
    [regForm, clientDataConsent, registerAndSignIn]
  )

  const submitSpecialistRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setRegError(null)
      const em = regForm.email?.trim().toLowerCase()
      const fullName = regForm.fullName?.trim()
      const password = regForm.password ?? ""
      if (!em?.includes("@")) {
        setRegError("Введите корректный email")
        return
      }
      if (!fullName) {
        setRegError("Введите ФИО")
        return
      }
      if (password.length < 8) {
        setRegError("Пароль должен быть не короче 8 символов")
        return
      }
      const phone = regForm.phone?.trim() ?? ""
      if (phone && !isValidPhoneNumber(phone)) {
        setRegError("Введите корректный номер телефона")
        return
      }
      if (!specialistDataConsent) {
        setRegError("Нужно согласие на обработку персональных данных")
        return
      }
      setRegLoading(true)
      try {
        const { error } = await registerAndSignIn({
          email: em,
          password,
          role: "SPECIALIST",
          name: fullName,
          phone,
          formData: { fullName, ...(phone ? { phone } : {}) },
        })
        if (error) setRegError(error)
      } catch {
        setRegError("Не удалось зарегистрироваться. Попробуйте позже.")
      } finally {
        setRegLoading(false)
      }
    },
    [regForm, specialistDataConsent, registerAndSignIn]
  )

  return {
    selected,
    setSelected,
    mobile,
    authOpen,
    regOpen,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    sent,
    regForm,
    setRegForm,
    regLoading,
    regError,
    closeAuth,
    closeReg,
    openAuth,
    openReg,
    sendMagicLinkAuth,
    signInWithPassword,
    submitClientRegister,
    submitSpecialistRegister,
    specialistDataConsent,
    setSpecialistDataConsent,
    clientDataConsent,
    setClientDataConsent,
    zitadelEnabled: process.env.NEXT_PUBLIC_ZITADEL_LOGIN === "1",
  }
}
