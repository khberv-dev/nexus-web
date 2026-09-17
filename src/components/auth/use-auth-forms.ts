"use client"

import {signIn} from "next-auth/react"
import {isValidPhoneNumber} from "react-phone-number-input"
import {useCallback, useState} from "react"
import {explainNextAuthEmailError} from "@/lib/auth/email-signin-user-message"
import {AUTH_CALLBACK, AUTH_ROLE_DB, type AuthRoleSlug} from "@/lib/auth/auth-routes"
import {parseNameParts} from "@/lib/user-name"

const MIN_PASSWORD_LENGTH = 8

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase()
}

/** Вход: email + пароль, либо ссылка на почту, если пароль не задан. */
export function useSignInForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState<"password" | "link" | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [linkSentTo, setLinkSentTo] = useState<string | null>(null)

    const signInWithPassword = useCallback(async () => {
        const e = normalizeEmail(email)
        if (!e.includes("@")) return setError("Введите корректный email")
        if (!password) return setError("Введите пароль")
        setError(null)
        setLoading("password")
        try {
            const res = await signIn("credentials", {email: e, password, redirect: false, callbackUrl: AUTH_CALLBACK})
            if (res?.error) {
                setError("Неверный email или пароль")
                return
            }
            globalThis.location.assign(res?.url ?? AUTH_CALLBACK)
        } catch {
            setError("Не удалось выполнить вход. Попробуйте позже.")
        } finally {
            setLoading(null)
        }
    }, [email, password])

    const sendMagicLink = useCallback(async () => {
        const e = normalizeEmail(email)
        if (!e.includes("@")) return setError("Введите email, на который прислать ссылку")
        setError(null)
        setLoading("link")
        try {
            const checkRes = await fetch(`/api/auth/pending-signup?email=${encodeURIComponent(e)}`)
            const {exists} = (await checkRes.json()) as { exists: boolean }
            if (!exists) {
                setError("Такого аккаунта ещё нет. Сначала зарегистрируйтесь.")
                return
            }
            const res = await signIn("email", {email: e, redirect: false, callbackUrl: AUTH_CALLBACK})
            if (res?.error) {
                setError(explainNextAuthEmailError(res.error))
                return
            }
            setLinkSentTo(e)
        } catch {
            setError("Не удалось отправить ссылку. Попробуйте позже.")
        } finally {
            setLoading(null)
        }
    }, [email])

    return {
        email, setEmail, password, setPassword,
        loading, error, linkSentTo,
        resetLinkSent: () => setLinkSentTo(null),
        signInWithPassword, sendMagicLink,
    }
}

export type SignUpFields = {
    firstName: string
    lastName: string
    email: string
    phone: string
    password: string
}

const EMPTY_SIGN_UP: SignUpFields = {firstName: "", lastName: "", email: "", phone: "", password: ""}

/** Регистрация: создаёт аккаунт сразу (без письма) и входит через credentials. Телефон необязателен. */
export function useSignUpForm(role: AuthRoleSlug) {
    const [fields, setFields] = useState<SignUpFields>(EMPTY_SIGN_UP)
    const [consent, setConsent] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<{ message: string } | null>(null)

    const setField = useCallback(<K extends keyof SignUpFields>(key: K, value: SignUpFields[K]) => {
        setFields((prev) => ({...prev, [key]: value}))
    }, [])

    const submit = useCallback(async () => {
        const dbRole = AUTH_ROLE_DB[role]
        if (dbRole === "ADMIN") return
        const names = parseNameParts(fields, {required: true})
        if ("error" in names) return setError({message: names.error})
        const email = normalizeEmail(fields.email)
        if (!email.includes("@")) return setError({message: "Введите корректный email"})
        const phone = fields.phone.trim()
        if (!phone) return setError({message: "Введите номер телефона"})
        if (!isValidPhoneNumber(phone)) return setError({message: "Введите корректный номер телефона"})
        if (fields.password.length < MIN_PASSWORD_LENGTH) {
            return setError({message: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`})
        }
        if (!consent) return setError({message: "Нужно согласие на обработку персональных данных"})

        setError(null)
        setLoading(true)
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    email,
                    password: fields.password,
                    role: dbRole,
                    firstName: names.firstName,
                    lastName: names.lastName,
                    phone,
                    formData: {...(phone ? {phone} : {}), ...(dbRole === "CLIENT" ? {email} : {})},
                }),
            })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
                if (res.status === 409 && data.code === "ALREADY_REGISTERED") {
                    setError({message: "Вы уже зарегистрированы — войдите в аккаунт."})
                } else {
                    setError({message: data.error ?? "Не удалось зарегистрироваться. Попробуйте позже."})
                }
                return
            }

            const signInRes = await signIn("credentials", {
                email,
                password: fields.password,
                redirect: false,
                callbackUrl: AUTH_CALLBACK,
            })
            if (signInRes?.error) {
                setError({message: "Аккаунт создан, но войти не получилось. Войдите вручную."})
                return
            }
            globalThis.location.assign(signInRes?.url ?? AUTH_CALLBACK)
        } catch {
            setError({message: "Не удалось зарегистрироваться. Попробуйте позже."})
        } finally {
            setLoading(false)
        }
    }, [consent, fields, role])

    return {fields, setField, consent, setConsent, loading, error, submit}
}
