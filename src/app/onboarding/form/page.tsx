"use client"

import {useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {toast} from "sonner"
import {OnboardingShell} from "@/components/app/OnboardingShell"
import {AppCard} from "@/components/app/AppCard"
import {PhoneField} from "@/components/ui/PhoneField"
import {PortfolioLinksField, splitPortfolioLinks} from "@/components/ui/PortfolioLinksField"

// ─── Типы AI ─────────────────────────────────────────────────────────────────

interface AISuggestion {
    field: string | null
    tip: string
    reason: string
    example: string
}

const FIELD_LABELS: Record<string, string> = {
    fullName: "ФИО", city: "Город", experience: "Опыт",
    portfolio: "Портфолио", software: "Программы", aiServices: "Нейросети", about: "О себе",
}

const FIELDS = [
    {name: "fullName", label: "ФИО", type: "text", placeholder: "Иван Иванов", required: true},
    {name: "email", label: "Email", type: "email", placeholder: "ivan@example.com", required: true},
    {name: "city", label: "Город", type: "text", placeholder: "Москва", required: true},
    {name: "experience", label: "Опыт работы (лет)", type: "number", placeholder: "3", required: true},
    {name: "sqm", label: "Реализовано м²", type: "number", placeholder: "1200", required: false},
    {name: "interiorStyle", label: "Интерьерный стиль", type: "text", placeholder: "Минимализм, Лофт", required: false},
    {
        name: "specialty",
        label: "Специализация",
        type: "text",
        placeholder: "Коммерческие интерьеры, офисы",
        required: false
    },
    {name: "portfolio", label: "Портфолио", type: "url", placeholder: "https://behance.net/...", required: false},
    {name: "has3d", label: "3D моделирование", type: "toggle", placeholder: "", required: false},
    {name: "hasRd", label: "Чертежи", type: "toggle", placeholder: "", required: false},
    {
        name: "software",
        label: "Программы",
        type: "software",
        placeholder: "Начните вводить или выберите ниже…",
        required: false
    },
    {
        name: "aiServices",
        label: "Нейросети",
        type: "ai",
        placeholder: "Начните вводить или выберите ниже…",
        required: false
    },
    {
        name: "about",
        label: "О себе",
        type: "textarea",
        placeholder: "Расскажите о вашем опыте и специализации...",
        required: true
    },
]

const TAX_STATUSES = [
    {value: "IP", label: "ИП", desc: "Индивидуальный предприниматель"},
    {value: "SZ", label: "Самозанятый", desc: "Налог на профессиональный доход (НПД)"},
    {value: "OOO", label: "ООО", desc: "Юридическое лицо"},
]

const SOFTWARE_SUGGESTIONS = [
    // CAD / BIM
    "AutoCAD", "nanoCAD", "ArchiCAD", "Revit", "Chief Architect",
    // 3D моделирование
    "3ds Max", "SketchUp", "Blender", "Cinema 4D",
    // Рендер / визуализация
    "V-Ray", "Corona Renderer", "Lumion", "Twinmotion", "Enscape", "Unreal Engine",
    // Презентации и графика
    "Photoshop", "Illustrator", "InDesign", "Figma",
]

const AI_SERVICE_SUGGESTIONS = [
    // Текст / ассистенты
    "ChatGPT", "Claude", "Gemini", "DeepSeek", "Perplexity", "Copilot", "Grok",
    // Изображения / визуализация
    "Midjourney", "DALL-E", "Stable Diffusion", "Adobe Firefly",
    // Видео
    "Runway", "Luma",
]

const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#f4f4f4",
    fontSize: "0.9rem",
    padding: "0.7em 1em",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
}

const highlightedAutoFillInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.35)",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.06)",
}

export default function OnboardingFormPage() {
    const router = useRouter()
    const [form, setForm] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // AI drawer
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [videoOpen, setVideoOpen] = useState(false)
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
    const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set())
    const [loadingAI, setLoadingAI] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)

    // Переключение программы в поле software
    const lookupInn = async (inn: string) => {
        setForm(f => ({...f, inn}))
        const cleanInn = inn.replace(/\D/g, "")
        const isIpInn = form.taxStatus === "IP" && cleanInn.length === 12
        const isOooInn = form.taxStatus === "OOO" && cleanInn.length === 10
        if (isIpInn || isOooInn) {
            try {
                const res = await fetch("/api/dadata/party", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({inn: cleanInn})
                })
                const data = await res.json()
                if (data.found) {
                    setForm(f => ({
                        ...f,
                        ...(form.taxStatus === "IP"
                            ? {ogrnip: data.ogrn ?? f.ogrnip ?? "", ipName: data.fullName ?? ""}
                            : {
                                companyName: data.name ?? f.companyName ?? "",
                                kpp: data.kpp ?? "",
                                ogrn: data.ogrn ?? "",
                                legalAddress: data.address ?? "",
                            }),
                    }))
                }
            } catch {
                toast.error("Не удалось загрузить данные по ИНН. Заполните реквизиты вручную.")
            }
        }
    }

    const lookupBik = async (bik: string) => {
        setForm(f => ({...f, bankBik: bik}))
        if (bik.replace(/\D/g, "").length === 9) {
            try {
                const res = await fetch("/api/dadata/bank", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({bik: bik.replace(/\D/g, "")})
                })
                const data = await res.json()
                if (data.found) setForm(f => ({...f, bankName: data.bankName ?? ""}))
            } catch {
                toast.error("Не удалось загрузить данные банка по БИК. Заполните вручную.")
            }
        }
    }

    const toggleSoftware = (name: string) => {
        const current = (form.software ?? "").split(",").map(s => s.trim()).filter(Boolean)
        const exists = current.some(s => s.toLowerCase() === name.toLowerCase())
        const next = exists
            ? current.filter(s => s.toLowerCase() !== name.toLowerCase())
            : [...current, name]
        setForm(f => ({...f, software: next.join(", ")}))
    }

    const activeSoftware = new Set(
        (form.software ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
    )

    // Переключение нейросети в поле aiServices — тот же паттерн, что и для software
    const toggleAiService = (name: string) => {
        const current = (form.aiServices ?? "").split(",").map(s => s.trim()).filter(Boolean)
        const exists = current.some(s => s.toLowerCase() === name.toLowerCase())
        const next = exists
            ? current.filter(s => s.toLowerCase() !== name.toLowerCase())
            : [...current, name]
        setForm(f => ({...f, aiServices: next.join(", ")}))
    }

    const activeAiServices = new Set(
        (form.aiServices ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
    )

    const openDrawer = async () => {
        setDrawerOpen(true)
        setLoadingAI(true)
        setAiError(null)
        setSuggestions([])
        setAppliedIdx(new Set())
        try {
            const res = await fetch("/api/ai/onboarding-suggest", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(form),
            })
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setSuggestions(json.suggestions ?? [])
        } catch {
            setAiError("Не удалось получить подсказки. Попробуйте позже.")
        } finally {
            setLoadingAI(false)
        }
    }

    const closeDrawer = () => setDrawerOpen(false)

    const applyAI = (idx: number, field: string | null, example: string) => {
        if (field) setForm(f => ({...f, [field]: example}))
        setAppliedIdx(prev => new Set(prev).add(idx))
    }

    useEffect(() => {
        fetch("/api/onboarding/apply")
            .then(r => r.json())
            .then(data => {
                if (data && typeof data === "object") setForm(data as Record<string, string>)
            })
            .catch(() => {
            })
    }, [])

    // Закрытие по Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeDrawer()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!["IP", "SZ", "OOO"].includes(form.taxStatus ?? "")) {
            setError("Выберите налоговый статус: ИП, самозанятый или ООО.")
            return
        }
        if (form.taxStatus === "OOO") {
            if (!form.companyName?.trim()) {
                setError("Укажите наименование ООО.")
                return
            }
            if ((form.inn ?? "").replace(/\D/g, "").length !== 10) {
                setError("Укажите ИНН организации (10 цифр).")
                return
            }
            if (!form.kpp?.trim()) {
                setError("Укажите КПП.")
                return
            }
            if (!form.ogrn?.trim()) {
                setError("Укажите ОГРН.")
                return
            }
            if (!form.legalAddress?.trim()) {
                setError("Укажите юридический адрес.")
                return
            }
            if (!form.corrAccount?.trim()) {
                setError("Укажите корреспондентский счет.")
                return
            }
        }
        if (form.taxStatus === "IP") {
            if ((form.inn ?? "").replace(/\D/g, "").length !== 12) {
                setError("Укажите ИНН ИП (12 цифр).")
                return
            }
        }
        if ((form.bankBik ?? "").trim() && (form.bankBik ?? "").replace(/\D/g, "").length !== 9) {
            setError("БИК должен содержать 9 цифр.")
            return
        }
        setLoading(true)
        setError(null)
        try {
            const payload = {...form, portfolio: splitPortfolioLinks(form.portfolio || "").join("\n")}
            const res = await fetch("/api/onboarding/apply", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error ?? "Ошибка сохранения")
            }
            setSaved(true)
            setTimeout(() => router.push("/onboarding"), 800)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка")
        } finally {
            setLoading(false)
        }
    }

    return (
        <OnboardingShell title="Анкета" backHref="/onboarding" backLabel="Онбординг" withBg>
            <div className="mx-auto max-w-xl px-6 py-12">
                <div className="mb-8">
                    <h1 style={{color: "#f4f4f4", fontSize: "clamp(1.4rem,3vw,1.8rem)", fontWeight: 500, margin: 0}}>
                        Шаг 1 — Анкета специалиста
                    </h1>
                    <p style={{color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.9rem"}}>
                        После отправки администратор проверит анкету и пригласит вас на тест
                    </p>
                </div>

                <AppCard>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div
                            className="onb-grid-2"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: "0.9rem 0.75rem",
                            }}
                        >
                            {FIELDS.map(field => {
                                const isWide = field.type === "textarea" || field.type === "software" || field.type === "ai" || field.name === "portfolio"
                                return (
                                    <div
                                        key={field.name}
                                        className="flex flex-col gap-1.5"
                                        style={isWide ? {gridColumn: "1 / -1"} : undefined}
                                    >
                                        <label style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontWeight: 500
                                        }}>
                                            {field.label}
                                        </label>

                                        {field.name === "portfolio" ? (
                                            <PortfolioLinksField
                                                value={form.portfolio || ""}
                                                onChange={v => setForm(f => ({...f, portfolio: v}))}
                                                inputStyle={inputStyle}
                                                placeholder={field.placeholder}
                                                addButtonStyle={{
                                                    alignSelf: "flex-start",
                                                    padding: "0.4em 0.9em",
                                                    borderRadius: 8,
                                                    border: "1px dashed rgba(255,255,255,0.25)",
                                                    background: "transparent",
                                                    color: "rgba(255,255,255,0.55)",
                                                    fontSize: "0.82rem",
                                                    cursor: "pointer",
                                                    fontFamily: "inherit",
                                                }}
                                                removeButtonStyle={{
                                                    flexShrink: 0,
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 6,
                                                    border: "1px solid rgba(255,255,255,0.15)",
                                                    background: "transparent",
                                                    color: "rgba(255,255,255,0.45)",
                                                    cursor: "pointer",
                                                    fontFamily: "inherit",
                                                    lineHeight: 1,
                                                }}
                                            />
                                        ) : field.type === "toggle" ? (
                                            <button
                                                type="button"
                                                onClick={() => setForm(f => ({
                                                    ...f,
                                                    [field.name]: f[field.name] === "true" ? "false" : "true"
                                                }))}
                                                style={{
                                                    padding: "0.5em 1.2em",
                                                    borderRadius: 8,
                                                    fontSize: "0.85rem",
                                                    cursor: "pointer",
                                                    fontFamily: "inherit",
                                                    border: form[field.name] === "true" ? "1.5px solid rgba(52,211,153,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
                                                    background: form[field.name] === "true" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                                                    color: form[field.name] === "true" ? "#34d399" : "rgba(255,255,255,0.5)",
                                                    width: "100%",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {form[field.name] === "true" ? "✓ Да" : "Нет"}
                                            </button>
                                        ) : field.type === "phone" ? (
                                            <PhoneField
                                                value={form[field.name] || ""}
                                                onChange={v => setForm(f => ({...f, [field.name]: v}))}
                                                required={field.required}
                                                className="onb-phone"
                                            />
                                        ) : field.type === "textarea" ? (
                                            <textarea
                                                rows={4}
                                                placeholder={field.placeholder}
                                                value={form[field.name] || ""}
                                                onChange={e => setForm(f => ({...f, [field.name]: e.target.value}))}
                                                style={{...inputStyle, resize: "vertical"}}
                                                required={field.required}
                                            />
                                        ) : field.type === "software" ? (
                                            <>
                                                <input
                                                    type="text"
                                                    placeholder={field.placeholder}
                                                    value={form[field.name] || ""}
                                                    onChange={e => setForm(f => ({...f, [field.name]: e.target.value}))}
                                                    style={inputStyle}
                                                    onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                                                />
                                                <div style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: "0.4em",
                                                    marginTop: "0.2em"
                                                }}>
                                                    {SOFTWARE_SUGGESTIONS.map(sw => {
                                                        const active = activeSoftware.has(sw.toLowerCase())
                                                        return (
                                                            <button
                                                                key={sw}
                                                                type="button"
                                                                onClick={() => toggleSoftware(sw)}
                                                                style={{
                                                                    background: active ? "rgba(121,40,202,0.3)" : "rgba(255,255,255,0.04)",
                                                                    border: `1px solid ${active ? "rgba(121,40,202,0.55)" : "rgba(255,255,255,0.1)"}`,
                                                                    borderRadius: 100,
                                                                    color: active ? "#e0d0ff" : "rgba(255,255,255,0.45)",
                                                                    cursor: "pointer",
                                                                    fontSize: "0.75rem",
                                                                    fontFamily: "inherit",
                                                                    padding: "0.3em 0.8em",
                                                                    transition: "all 0.15s",
                                                                }}
                                                            >
                                                                {active && <span style={{
                                                                    marginRight: "0.3em",
                                                                    fontSize: "0.65rem"
                                                                }}>✓</span>}
                                                                {sw}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        ) : field.type === "ai" ? (
                                            <>
                                                <input
                                                    type="text"
                                                    placeholder={field.placeholder}
                                                    value={form[field.name] || ""}
                                                    onChange={e => setForm(f => ({...f, [field.name]: e.target.value}))}
                                                    style={inputStyle}
                                                    onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                                                />
                                                <div style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: "0.4em",
                                                    marginTop: "0.2em"
                                                }}>
                                                    {AI_SERVICE_SUGGESTIONS.map(ai => {
                                                        const active = activeAiServices.has(ai.toLowerCase())
                                                        return (
                                                            <button
                                                                key={ai}
                                                                type="button"
                                                                onClick={() => toggleAiService(ai)}
                                                                style={{
                                                                    background: active ? "rgba(121,40,202,0.3)" : "rgba(255,255,255,0.04)",
                                                                    border: `1px solid ${active ? "rgba(121,40,202,0.55)" : "rgba(255,255,255,0.1)"}`,
                                                                    borderRadius: 100,
                                                                    color: active ? "#e0d0ff" : "rgba(255,255,255,0.45)",
                                                                    cursor: "pointer",
                                                                    fontSize: "0.75rem",
                                                                    fontFamily: "inherit",
                                                                    padding: "0.3em 0.8em",
                                                                    transition: "all 0.15s",
                                                                }}
                                                            >
                                                                {active && <span style={{
                                                                    marginRight: "0.3em",
                                                                    fontSize: "0.65rem"
                                                                }}>✓</span>}
                                                                {ai}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <input
                                                type={field.type}
                                                placeholder={field.placeholder}
                                                value={form[field.name] || ""}
                                                onChange={e => setForm(f => ({...f, [field.name]: e.target.value}))}
                                                style={inputStyle}
                                                onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                                                required={field.required}
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Tax status & requisites */}
                        <div className="flex flex-col gap-3" style={{
                            marginTop: 8,
                            padding: "1rem",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.08)"
                        }}>
                            <label style={{color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500}}>Налоговый
                                статус (обязательно)</label>
                            <div style={{display: "flex", gap: "0.5rem"}}>
                                {TAX_STATUSES.map(s => (
                                    <button key={s.value} type="button"
                                            onClick={() => setForm(f => ({...f, taxStatus: s.value}))} style={{
                                        flex: 1,
                                        padding: "0.7em",
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        textAlign: "center",
                                        border: form.taxStatus === s.value ? "1.5px solid rgba(52,211,153,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
                                        background: form.taxStatus === s.value ? "rgba(52,211,153,0.08)" : "transparent",
                                        color: form.taxStatus === s.value ? "#34d399" : "rgba(255,255,255,0.5)",
                                    }}>
                                        <div style={{fontWeight: 600, fontSize: "0.85rem"}}>{s.label}</div>
                                        <div style={{fontSize: "0.7rem", opacity: 0.7, marginTop: 2}}>{s.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {form.taxStatus === "SZ" && (
                                <div style={{
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    background: "rgba(99,102,241,0.06)",
                                    border: "1px solid rgba(99,102,241,0.15)",
                                    fontSize: "0.78rem",
                                    color: "rgba(255,255,255,0.6)"
                                }}>
                                    <i className="bx bx-info-circle" style={{marginRight: 4, color: "#6366f1"}}/>
                                    Самозанятый формирует чеки в приложении «Мой налог» после каждой выплаты. Платформа
                                    является агентом.
                                    <button type="button" onClick={() => setVideoOpen(true)} style={{
                                        display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8,
                                        background: "none", border: "none", cursor: "pointer", color: "#6366f1",
                                        fontSize: "0.78rem", fontFamily: "inherit", textDecoration: "underline",
                                    }}>
                                        <i className="bx bx-play-circle"/>Видео-инструкция
                                    </button>
                                </div>
                            )}

                            {(form.taxStatus === "IP" || form.taxStatus === "SZ" || form.taxStatus === "OOO") && (
                                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem"}}>
                                    <div className="flex flex-col gap-1.5">
                                        <label style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontWeight: 500
                                        }}>
                                            ИНН {form.taxStatus === "OOO" ? "(10 цифр)" : "(12 цифр)"}
                                        </label>
                                        <input
                                            type="text"
                                            value={form.inn || ""}
                                            onChange={e => lookupInn(e.target.value)}
                                            style={highlightedAutoFillInputStyle}
                                            maxLength={form.taxStatus === "OOO" ? 10 : 12}
                                            placeholder={form.taxStatus === "OOO" ? "7707083893" : "123456789012"}
                                            onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                        <div style={{
                                            fontSize: "0.72rem",
                                            color: "rgba(255,255,255,0.38)",
                                            marginTop: 4
                                        }}>
                                            Подтянем данные автоматически после ввода ИНН.
                                        </div>
                                        {form.taxStatus === "IP" && form.ipName && <div style={{
                                            fontSize: "0.75rem",
                                            color: "#34d399",
                                            marginTop: 2
                                        }}>{form.ipName}</div>}
                                        {form.taxStatus === "OOO" && form.companyName && <div style={{
                                            fontSize: "0.75rem",
                                            color: "#34d399",
                                            marginTop: 2
                                        }}>{form.companyName}</div>}
                                    </div>
                                    {form.taxStatus === "IP" && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>Наименование ИП</label>
                                                <input type="text" value={form.ipName || ""}
                                                       onChange={e => setForm(f => ({...f, ipName: e.target.value}))}
                                                       style={inputStyle} placeholder="ИП Иванов Иван Иванович"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>ОГРНИП</label>
                                                <input type="text" value={form.ogrnip || ""}
                                                       onChange={e => setForm(f => ({...f, ogrnip: e.target.value}))}
                                                       style={inputStyle} maxLength={15} placeholder="304770000000000"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>Дата регистрации ИП</label>
                                                <input type="text" value={form.ipRegDate || ""}
                                                       onChange={e => setForm(f => ({...f, ipRegDate: e.target.value}))}
                                                       style={inputStyle} placeholder="01.01.2020"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                        </>
                                    )}
                                    {form.taxStatus === "OOO" && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>Наименование ООО</label>
                                                <input type="text" value={form.companyName || ""}
                                                       onChange={e => setForm(f => ({
                                                           ...f,
                                                           companyName: e.target.value
                                                       }))} style={inputStyle} placeholder="ООО «Пространство»"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>КПП</label>
                                                <input type="text" value={form.kpp || ""}
                                                       onChange={e => setForm(f => ({...f, kpp: e.target.value}))}
                                                       style={inputStyle} maxLength={9} placeholder="770701001"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>ОГРН</label>
                                                <input type="text" value={form.ogrn || ""}
                                                       onChange={e => setForm(f => ({...f, ogrn: e.target.value}))}
                                                       style={inputStyle} maxLength={13} placeholder="1027700132195"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                            <div className="flex flex-col gap-1.5" style={{gridColumn: "1 / -1"}}>
                                                <label style={{
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: "0.8rem",
                                                    fontWeight: 500
                                                }}>Юридический адрес</label>
                                                <input type="text" value={form.legalAddress || ""}
                                                       onChange={e => setForm(f => ({
                                                           ...f,
                                                           legalAddress: e.target.value
                                                       }))} style={inputStyle}
                                                       placeholder="г. Москва, ул. Примерная, д. 1"
                                                       onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                       onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex flex-col gap-1.5">
                                        <label style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontWeight: 500
                                        }}>{form.taxStatus === "SZ" ? "Счет карты / р/с" : "Расчетный счет"}</label>
                                        <input type="text" value={form.bankAccount || ""}
                                               onChange={e => setForm(f => ({...f, bankAccount: e.target.value}))}
                                               style={inputStyle} maxLength={20} placeholder="40802810000000000000"
                                               onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                               onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontWeight: 500
                                        }}>Банк</label>
                                        <input type="text" value={form.bankName || ""}
                                               onChange={e => setForm(f => ({...f, bankName: e.target.value}))}
                                               style={inputStyle} placeholder="АО «Т-Банк»"
                                               onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                               onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontWeight: 500
                                        }}>БИК</label>
                                        <input type="text" value={form.bankBik || ""}
                                               onChange={e => lookupBik(e.target.value)}
                                               style={highlightedAutoFillInputStyle} maxLength={9}
                                               placeholder="044525974"
                                               onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                               onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                        <div style={{
                                            fontSize: "0.72rem",
                                            color: "rgba(255,255,255,0.38)",
                                            marginTop: 4
                                        }}>
                                            Подтянем банк автоматически после ввода БИК.
                                        </div>
                                    </div>
                                    {form.taxStatus === "OOO" && (
                                        <div className="flex flex-col gap-1.5">
                                            <label style={{
                                                color: "rgba(255,255,255,0.5)",
                                                fontSize: "0.8rem",
                                                fontWeight: 500
                                            }}>Корр. счет</label>
                                            <input type="text" value={form.corrAccount || ""}
                                                   onChange={e => setForm(f => ({...f, corrAccount: e.target.value}))}
                                                   style={inputStyle} maxLength={20} placeholder="30101810000000000000"
                                                   onFocus={e => (e.target.style.borderColor = "rgba(255,255,255,0.35)")}
                                                   onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}/>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{
                                color: "#f87171",
                                fontSize: "0.85rem",
                                background: "rgba(240,20,20,0.1)",
                                border: "1px solid rgba(240,20,20,0.2)",
                                borderRadius: 8,
                                padding: "0.6em 1em"
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{display: "flex", gap: "0.75rem", marginTop: 4}}>
                            <button
                                type="submit"
                                disabled={loading || saved}
                                style={{
                                    flex: 1,
                                    background: saved ? "rgba(52,211,153,0.15)" : loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
                                    border: `1px solid ${saved ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.2)"}`,
                                    borderRadius: 8,
                                    color: "#f4f4f4",
                                    cursor: loading || saved ? "not-allowed" : "pointer",
                                    fontSize: "0.9rem",
                                    fontWeight: 500,
                                    padding: "0.8em 1.5em",
                                    fontFamily: "inherit",
                                    transition: "background 0.2s",
                                }}
                            >
                                {saved ? "✓ Сохранено" : loading ? "Сохранение…" : "Отправить анкету"}
                            </button>

                            <button
                                type="button"
                                onClick={openDrawer}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4em",
                                    background: "rgba(121,40,202,0.18)",
                                    border: "1px solid rgba(121,40,202,0.35)",
                                    borderRadius: 8,
                                    color: "rgba(255,255,255,0.75)",
                                    cursor: "pointer",
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                    padding: "0.8em 1.25em",
                                    fontFamily: "inherit",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <span>✨</span> Подсказки AI
                            </button>
                        </div>
                    </form>
                </AppCard>
            </div>

            {/* ── Drawer root (clips overflow, не дает странице расширяться) ── */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    overflow: "hidden",
                    pointerEvents: drawerOpen ? "auto" : "none",
                    zIndex: 40,
                }}
            >
                {/* Backdrop */}
                <div
                    onClick={closeDrawer}
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                        backdropFilter: "blur(2px)",
                        opacity: drawerOpen ? 1 : 0,
                        transition: "opacity 0.3s ease",
                    }}
                />

                {/* ── Drawer ── */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "min(420px, 92vw)",
                        background: "#0d1230",
                        borderLeft: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
                        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                        fontFamily: "'PP Neue Montreal', 'Inter', Arial, sans-serif",
                    }}
                >
                    {/* Шапка */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1.25rem 1.5rem",
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                        flexShrink: 0,
                    }}>
                        <div style={{display: "flex", alignItems: "center", gap: "0.6em"}}>
                            <span style={{fontSize: "1.1rem"}}>✨</span>
                            <span style={{color: "#f4f4f4", fontSize: "0.95rem", fontWeight: 500}}>
                AI-подсказки
              </span>
                            <span style={{
                                background: "rgba(121,40,202,0.25)",
                                borderRadius: 100,
                                color: "rgba(255,255,255,0.4)",
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                letterSpacing: "0.05em",
                                padding: "0.2em 0.65em",
                                textTransform: "uppercase",
                            }}>
                только подсказки
              </span>
                        </div>
                        <button
                            onClick={closeDrawer}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 6,
                                color: "rgba(255,255,255,0.45)",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                lineHeight: 1,
                                padding: "0.35em 0.6em",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Контент */}
                    <div style={{flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem"}}>

                        {loadingAI && (
                            <div style={{display: "flex", flexDirection: "column", gap: "0.75rem"}}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.07)",
                                        borderRadius: 10,
                                        padding: "1rem 1.1rem",
                                        animation: "pulse 1.5s ease-in-out infinite",
                                    }}>
                                        <div style={{
                                            background: "rgba(255,255,255,0.07)",
                                            borderRadius: 4,
                                            height: 10,
                                            width: "40%",
                                            marginBottom: 10
                                        }}/>
                                        <div style={{
                                            background: "rgba(255,255,255,0.05)",
                                            borderRadius: 4,
                                            height: 8,
                                            width: "85%",
                                            marginBottom: 8
                                        }}/>
                                        <div style={{
                                            background: "rgba(255,255,255,0.04)",
                                            borderRadius: 4,
                                            height: 8,
                                            width: "65%"
                                        }}/>
                                    </div>
                                ))}
                                <p style={{
                                    color: "rgba(255,255,255,0.25)",
                                    fontSize: "0.8rem",
                                    textAlign: "center",
                                    margin: "0.5rem 0 0"
                                }}>
                                    Анализирую анкету…
                                </p>
                            </div>
                        )}

                        {aiError && (
                            <div style={{
                                background: "rgba(240,20,20,0.07)",
                                border: "1px solid rgba(240,20,20,0.2)",
                                borderRadius: 10,
                                padding: "1rem 1.1rem",
                            }}>
                                <p style={{
                                    color: "rgba(255,100,100,0.8)",
                                    fontSize: "0.875rem",
                                    margin: 0
                                }}>{aiError}</p>
                                <button
                                    onClick={openDrawer}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "rgba(255,255,255,0.4)",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        fontFamily: "inherit",
                                        marginTop: "0.6em",
                                        padding: 0,
                                        textDecoration: "underline",
                                    }}
                                >
                                    Попробовать снова
                                </button>
                            </div>
                        )}

                        {!loadingAI && !aiError && suggestions.map((s, i) => {
                            const isApplied = appliedIdx.has(i)
                            const label = s.field ? FIELD_LABELS[s.field] : null
                            return (
                                <div
                                    key={i}
                                    style={{
                                        background: isApplied ? "rgba(52,211,153,0.05)" : "rgba(121,40,202,0.08)",
                                        border: `1px solid ${isApplied ? "rgba(52,211,153,0.2)" : "rgba(121,40,202,0.22)"}`,
                                        borderRadius: 10,
                                        marginBottom: "0.75rem",
                                        opacity: isApplied ? 0.55 : 1,
                                        padding: "1rem 1.1rem",
                                        transition: "opacity 0.3s",
                                    }}
                                >
                                    {label && (
                                        <div style={{
                                            color: "rgba(121,40,202,0.9)",
                                            fontSize: "0.68rem",
                                            fontWeight: 600,
                                            letterSpacing: "0.07em",
                                            marginBottom: "0.4em",
                                            textTransform: "uppercase",
                                        }}>
                                            {label}
                                        </div>
                                    )}
                                    <p style={{
                                        color: "#f4f4f4",
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        margin: "0 0 0.3em"
                                    }}>
                                        {s.tip}
                                    </p>
                                    <p style={{
                                        color: "rgba(255,255,255,0.4)",
                                        fontSize: "0.8rem",
                                        margin: "0 0 0.875em"
                                    }}>
                                        {s.reason}
                                    </p>
                                    <div style={{
                                        background: "rgba(0,0,0,0.2)",
                                        borderRadius: 7,
                                        marginBottom: "0.75rem",
                                        padding: "0.65rem 0.875rem",
                                    }}>
                                        <p style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "0.8rem",
                                            fontStyle: "italic",
                                            margin: 0
                                        }}>
                                            «{s.example}»
                                        </p>
                                    </div>
                                    <div style={{display: "flex", justifyContent: "flex-end"}}>
                                        {isApplied ? (
                                            <span style={{color: "rgba(52,211,153,0.7)", fontSize: "0.78rem"}}>✓ Применено</span>
                                        ) : s.field ? (
                                            <button
                                                onClick={() => applyAI(i, s.field, s.example)}
                                                style={{
                                                    background: "rgba(121,40,202,0.22)",
                                                    border: "1px solid rgba(121,40,202,0.38)",
                                                    borderRadius: 6,
                                                    color: "rgba(255,255,255,0.75)",
                                                    cursor: "pointer",
                                                    fontSize: "0.78rem",
                                                    fontFamily: "inherit",
                                                    padding: "0.35em 0.9em",
                                                }}
                                            >
                                                Применить →
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Подвал */}
                    {!loadingAI && suggestions.length > 0 && (
                        <div style={{
                            borderTop: "1px solid rgba(255,255,255,0.07)",
                            flexShrink: 0,
                            padding: "1rem 1.5rem",
                        }}>
                            <button
                                onClick={openDrawer}
                                style={{
                                    background: "rgba(121,40,202,0.12)",
                                    border: "1px solid rgba(121,40,202,0.25)",
                                    borderRadius: 8,
                                    color: "rgba(255,255,255,0.5)",
                                    cursor: "pointer",
                                    fontSize: "0.8rem",
                                    fontFamily: "inherit",
                                    padding: "0.6em 1em",
                                    width: "100%",
                                }}
                            >
                                ↺ Обновить подсказки
                            </button>
                        </div>
                    )}
                </div>

            </div>
            {/* /drawer root */}

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 640px) {
          .onb-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
        .onb-phone .PhoneInputInput {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; color: #f4f4f4; font-size: 0.9rem; padding: 0.7em 1em;
          outline: none; font-family: inherit; width: 100%;
        }
        .onb-phone .PhoneInputCountry { margin-right: 8px; }
        .onb-phone .PhoneInputCountrySelect { background: #1a1a2e; color: #f4f4f4; border: none; }
      `}</style>
            {/* Video instruction modal */}
            {videoOpen && (
                <div onClick={() => setVideoOpen(false)} style={{
                    position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.8)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: "100%",
                        maxWidth: 640,
                        borderRadius: 16,
                        overflow: "hidden",
                        background: "#000",
                        position: "relative"
                    }}>
                        <button onClick={() => setVideoOpen(false)} style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            zIndex: 10,
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.15)",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "1rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}><i className="bx bx-x"/></button>
                        <video src="/sz/payment_agents.mp4" controls autoPlay playsInline
                               style={{width: "100%", display: "block"}}/>
                    </div>
                </div>
            )}

        </OnboardingShell>
    )
}
