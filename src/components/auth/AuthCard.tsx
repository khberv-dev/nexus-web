"use client"

import Link from "next/link"
import {useSearchParams} from "next/navigation"
import type {CSSProperties, FormEvent, ReactNode} from "react"
import {signIn} from "next-auth/react"
import {PhoneField} from "@/components/ui/PhoneField"
import {
    AUTH_CALLBACK,
    AUTH_ROLE_LABEL,
    AUTH_ROLES,
    authHref,
    type AuthMode,
    type AuthRoleSlug,
    canSignUp,
    LEGAL_PERSONAL_DATA_HREF,
} from "@/lib/auth/auth-routes"
import {useSignInForm, useSignUpForm} from "./use-auth-forms"
import styles from "./auth-card.module.css"

type Props = {
    mode: AuthMode
    role: AuthRoleSlug
}

/** Выбор роли — вкладки на всю ширину; каждая ведёт на свой адрес и заменяет его в истории. */
function RoleSwitch({role, mode, search}: { role: AuthRoleSlug; mode: AuthMode; search: string }) {
    const tabStyle = {
        "--tab-count": AUTH_ROLES.length,
        "--tab-index": AUTH_ROLES.indexOf(role),
    } as CSSProperties
    return (
        <nav className={styles.tabs} style={tabStyle} aria-label="Роль">
            <span className={styles.tabIndicator} aria-hidden/>
            {AUTH_ROLES.map((r) => {
                const active = r === role
                return (
                    <Link
                        key={r}
                        href={authHref(mode, r, search)}
                        replace
                        scroll={false}
                        aria-current={active ? "page" : undefined}
                        className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                        onClick={active ? (e) => e.preventDefault() : undefined}
                    >
                        {AUTH_ROLE_LABEL[r]}
                    </Link>
                )
            })}
        </nav>
    )
}

function Field({label, required, children}: { label: string; required?: boolean; children: ReactNode }) {
    return (
        <label className={styles.field}>
            <span className={styles.label}>
                {label}
                {required && <span className={styles.required}>*</span>}
            </span>
            {children}
        </label>
    )
}

function SignUpForm({role}: { role: AuthRoleSlug }) {
    const {fields, setField, consent, setConsent, loading, error, submit} = useSignUpForm(role)

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        void submit()
    }

    return (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.row}>
                <Field label="Имя" required>
                    <input
                        className={styles.input}
                        autoComplete="given-name"
                        placeholder="Иван"
                        value={fields.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                    />
                </Field>
                <Field label="Фамилия" required>
                    <input
                        className={styles.input}
                        autoComplete="family-name"
                        placeholder="Иванов"
                        value={fields.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                    />
                </Field>
            </div>
            <Field label="Email" required>
                <input
                    className={styles.input}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={fields.email}
                    onChange={(e) => setField("email", e.target.value)}
                />
            </Field>
            <Field label="Телефон" required>
                <PhoneField value={fields.phone} onChange={(v) => setField("phone", v)} className="onb-phone"/>
            </Field>
            <Field label="Пароль" required>
                <input
                    className={styles.input}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Не короче 8 символов"
                    value={fields.password}
                    onChange={(e) => setField("password", e.target.value)}
                />
            </Field>

            <label className={styles.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
                <span>
                    Я принимаю{" "}
                    <Link href={LEGAL_PERSONAL_DATA_HREF} target="_blank" rel="noopener noreferrer"
                          className={styles.link}>
                        политику конфиденциальности и условия обработки персональных данных
                    </Link>
                    <span className={styles.required}>*</span>
                </span>
            </label>

            {error && <p className={styles.error} role="alert">{error.message}</p>}

            <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? "Регистрация…" : "Зарегистрироваться"}
            </button>
        </form>
    )
}

function SignInForm({role}: { role: AuthRoleSlug }) {
    const form = useSignInForm()
    const zitadelEnabled = process.env.NEXT_PUBLIC_ZITADEL_LOGIN === "1"

    if (form.linkSentTo) {
        return (
            <div className={styles.sent}>
                <p>Письмо со ссылкой для входа отправлено на <strong>{form.linkSentTo}</strong></p>
                <button type="button" className={styles.secondary} onClick={form.resetLinkSent}>
                    Ввести другой email
                </button>
            </div>
        )
    }

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        void form.signInWithPassword()
    }

    return (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
            <Field label="Email" required>
                <input
                    className={styles.input}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => form.setEmail(e.target.value)}
                />
            </Field>
            <Field label="Пароль">
                <input
                    className={styles.input}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => form.setPassword(e.target.value)}
                />
            </Field>

            {form.error && <p className={styles.error} role="alert">{form.error}</p>}

            <button type="submit" className={styles.primary} disabled={form.loading !== null}>
                {form.loading === "password" ? "Вход…" : "Войти"}
            </button>
            <button
                type="button"
                className={styles.secondary}
                disabled={form.loading !== null}
                onClick={() => void form.sendMagicLink()}
            >
                {form.loading === "link" ? "Отправляем ссылку…" : "Получить ссылку на почту"}
            </button>
            {zitadelEnabled && role !== "admin" && (
                <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => void signIn("zitadel", {callbackUrl: AUTH_CALLBACK})}
                >
                    Войти через Zitadel
                </button>
            )}
        </form>
    )
}

export function AuthCard({mode, role}: Props) {
    const search = useSearchParams().toString()
    const signUpAllowed = canSignUp(role)
    const isSignUp = signUpAllowed && mode === "signup"

    return (
        <section className={styles.card} aria-labelledby="auth-card-title">
            <div className={styles.head}>
                <h1 id="auth-card-title" className={styles.title}>{isSignUp ? "Регистрация" : "Вход"}</h1>
                <Link href="/" className={styles.close} aria-label="Закрыть">×</Link>
            </div>

            <RoleSwitch role={role} mode={isSignUp ? "signup" : "signin"} search={search}/>

            {isSignUp ? <SignUpForm key={role} role={role}/> : <SignInForm key={role} role={role}/>}

            {signUpAllowed && (
                <p className={styles.switch}>
                    {isSignUp ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
                    <Link
                        href={authHref(isSignUp ? "signin" : "signup", role, search)}
                        replace
                        scroll={false}
                        className={styles.link}
                    >
                        {isSignUp ? "Войти" : "Зарегистрироваться"}
                    </Link>
                </p>
            )}
        </section>
    )
}
