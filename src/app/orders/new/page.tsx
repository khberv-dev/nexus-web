"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {useSession} from "next-auth/react"
import Link from "next/link"
import "@/components/Community/Community.css"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {DashPageTitle} from "@/components/dashboard-ui/DashPageTitle"
import {DashSurfaceCard} from "@/components/dashboard-ui/DashSurfaceCard"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {BriefWizardAIDrawer} from "@/components/app/BriefWizardAIDrawer"
import {buildClientCabinetNavItems} from "@/components/Client/client-cabinet/constants"
import {CLIENT_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import {Button} from "@/components/ui/button"
import {
    BUDGET_FLEX,
    BUDGET_RANGE,
    BUDGET_SCOPE,
    LIGHTING,
    OBJ_STAGES,
    OBJECT_TYPES,
    PRIORITY,
    SQM_BUDGET,
    START_READY,
    STEPS,
    STYLES,
    TASKS,
} from "./briefConfig"
import {ADMIN_BRIEF_FIELD_GROUPS} from "@/lib/adminBriefFields"

type D = Record<string, string>

/** Prisma Json may deserialize numbers/booleans; PATCH only persisted strings and dropped the rest. */
function normalizeBriefData(raw: unknown): D {
    if (!raw || typeof raw !== "object") return {}
    const out: D = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (k.startsWith("_")) continue
        if (v == null) continue
        if (typeof v === "string") out[k] = v
        else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v)
        else if (typeof v === "boolean") out[k] = v ? "true" : "false"
    }
    return out
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.65em 0.875em", border: "1px solid var(--dash-border)", borderRadius: 8,
    fontSize: "0.85rem", color: "var(--dash-text)", background: "var(--dash-surface2)", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
}
const taStyle: React.CSSProperties = {...inputStyle, resize: "vertical", minHeight: 80}

function Chip({label, active, onClick}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} style={{
            padding: "0.4em 0.9em",
            borderRadius: 100,
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            border: active ? "1.5px solid var(--dash-accent)" : "1.5px solid var(--dash-border)",
            background: active ? "var(--dash-accent-bg)" : "transparent",
            color: active ? "var(--dash-accent)" : "var(--dash-text2)",
        }}>
            {active && <span style={{marginRight: "0.3em"}}>✓</span>}{label}
        </button>
    )
}

function Field({label, hint, required, children}: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode
}) {
    return (
        <div style={{marginBottom: "1.5rem"}}>
            <label style={{
                display: "block",
                fontSize: "0.68rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--dash-muted)",
                marginBottom: 6
            }}>
                {label}{required && <span style={{color: "var(--dash-danger, #c00)", marginLeft: 4}}>*</span>}
            </label>
            {children}
            {hint &&
                <p style={{fontSize: "0.73rem", color: "var(--dash-muted)", marginTop: 4, marginBottom: 0}}>{hint}</p>}
        </div>
    )
}

function Select({value, options, onChange}: { value: string; options: string[]; onChange: (v: string) => void }) {
    return (
        <select value={value || ""} onChange={e => onChange(e.target.value)}
                style={{...inputStyle, appearance: "auto"}}>
            <option value="">— выберите —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    )
}

// ── Step components ──

function StepObject({d, set}: { d: D; set: (k: string, v: string) => void }) {
    return <>
        <Field label="Тип объекта" required>
            <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8}}>
                {OBJECT_TYPES.map(t => (
                    <button key={t.label} type="button" onClick={() => set("objectType", t.label)} style={{
                        padding: "0.8em 0.5em",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "center",
                        border: d.objectType === t.label ? "2px solid var(--dash-accent)" : "1.5px solid var(--dash-border)",
                        background: d.objectType === t.label ? "var(--dash-accent-bg)" : "transparent",
                        color: d.objectType === t.label ? "var(--dash-accent)" : "var(--dash-text2)",
                        fontSize: "0.8rem",
                    }}>
                        <div style={{fontSize: "1.4rem", marginBottom: 4}}><i className={t.icon}/></div>
                        {t.label}
                    </button>
                ))}
            </div>
        </Field>
        <Field label="Сегмент бизнеса" required hint="Укажите отрасль: HoReCa, ретейл, IT, медицина и т.д."><input
            style={inputStyle} placeholder="HoReCa, ретейл, IT…" value={d.companySegment ?? ""}
            onChange={e => set("companySegment", e.target.value)}/></Field>
        <Field label="Описание бизнеса"
               hint="Чем занимается компания, кто ваши клиенты — это поможет дизайнеру понять контекст"><textarea
            style={taStyle} placeholder="Чем занимается компания, целевая аудитория…" value={d.companyDesc ?? ""}
            onChange={e => set("companyDesc", e.target.value)}/></Field>
        <Field label="Адрес объекта" required hint="Город и адрес — нужен для выезда дизайнера на замеры"><input
            style={inputStyle} placeholder="Москва, ул. Примерная, д. 1" value={d.objAddress ?? ""}
            onChange={e => set("objAddress", e.target.value)}/></Field>
        <Field label="Стадия объекта" required hint="На какой стадии находится помещение сейчас"><Select
            value={d.objStage ?? ""} options={OBJ_STAGES} onChange={v => set("objStage", v)}/></Field>
        <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem"}}>
            <Field label="Площадь, м²" required hint="Общая площадь всех помещений"><input type="number"
                                                                                           style={inputStyle}
                                                                                           placeholder="150"
                                                                                           value={d.objArea ?? ""}
                                                                                           onChange={e => set("objArea", e.target.value)}/></Field>
            <Field label="Этажей" hint="Количество уровней в помещении"><input type="number" style={inputStyle}
                                                                               placeholder="1" value={d.objFloors ?? ""}
                                                                               onChange={e => set("objFloors", e.target.value)}/></Field>
        </div>
        <Field label="Описание объекта"
               hint="Особенности: высота потолков, наличие окон, несущие стены, коммуникации"><textarea style={taStyle}
                                                                                                        placeholder="Особенности помещения, текущее состояние…"
                                                                                                        value={d.objDesc ?? ""}
                                                                                                        onChange={e => set("objDesc", e.target.value)}/></Field>
    </>
}

function StepTasks({d, set, toggle}: {
    d: D;
    set: (k: string, v: string) => void;
    toggle: (k: string, v: string) => void
}) {
    const active = new Set((d.tasks ?? "").split(",").map(s => s.trim()).filter(Boolean))
    return <>
        <Field label="Задачи проекта" hint="Выберите все подходящие">
            <div style={{display: "flex", flexWrap: "wrap", gap: "0.4rem"}}>
                {TASKS.map(t => <Chip key={t} label={t} active={active.has(t)} onClick={() => toggle("tasks", t)}/>)}
            </div>
        </Field>
        <Field label="Главная цель проекта" required hint="Одно предложение: что должен решить дизайн-проект"><input
            style={inputStyle} placeholder="Создать уютное пространство для команды из 30 человек"
            value={d.taskMain ?? ""} onChange={e => set("taskMain", e.target.value)}/></Field>
        <Field label="Целевая аудитория объекта" required
               hint="Кто будет пользоваться пространством: сотрудники, клиенты, посетители"><textarea style={taStyle}
                                                                                                      placeholder="Молодые специалисты 25-35 лет, ценящие комфорт"
                                                                                                      value={d.targetAudience ?? ""}
                                                                                                      onChange={e => set("targetAudience", e.target.value)}/></Field>
        <Field label="Конкуренты / референсные объекты" hint="Примеры похожих объектов, которые вам нравятся"><textarea
            style={taStyle} placeholder="Офис Яндекса, коворкинг SOK, ресторан White Rabbit" value={d.competitors ?? ""}
            onChange={e => set("competitors", e.target.value)}/></Field>
        <Field label="Что не устраивает в пространстве?"
               hint="Что хотите изменить: планировка, освещение, стиль, функциональность"><textarea style={taStyle}
                                                                                                    placeholder="Тёмные коридоры, неудобная планировка, устаревший ремонт"
                                                                                                    value={d.currentProblem ?? ""}
                                                                                                    onChange={e => set("currentProblem", e.target.value)}/></Field>
    </>
}

function StepStyle({d, set, toggle}: {
    d: D;
    set: (k: string, v: string) => void;
    toggle: (k: string, v: string) => void
}) {
    const active = new Set((d.styleDir ?? "").split(",").map(s => s.trim()).filter(Boolean))
    return <>
        <Field label="Стилевое направление" hint="Выберите одно или несколько">
            <div style={{display: "flex", flexWrap: "wrap", gap: "0.4rem"}}>
                {STYLES.map(s => <Chip key={s} label={s} active={active.has(s)}
                                       onClick={() => toggle("styleDir", s)}/>)}
            </div>
        </Field>
        <Field label="Пожелания по цветовой гамме" hint="Основные цвета, которые хотите видеть в интерьере"><input
            style={inputStyle} placeholder="Тёплые бежевые тона, акценты терракотового" value={d.colorPalette ?? ""}
            onChange={e => set("colorPalette", e.target.value)}/></Field>
        <Field label="Нежелательные цвета / элементы" hint="Что точно не должно быть в проекте"><input
            style={inputStyle} placeholder="Ярко-красный, неон, пластик" value={d.colorAvoid ?? ""}
            onChange={e => set("colorAvoid", e.target.value)}/></Field>
        <Field label="Освещение" hint="Какую атмосферу создать светом"><Select value={d.lightingPref ?? ""}
                                                                               options={LIGHTING}
                                                                               onChange={v => set("lightingPref", v)}/></Field>
        <Field label="Предпочтительные материалы" hint="Натуральные, искусственные, комбинация"><input
            style={inputStyle} placeholder="Дерево, камень, металл…" value={d.materials ?? ""}
            onChange={e => set("materials", e.target.value)}/></Field>
        <Field label="Образ / история пространства" hint="Самое важное — здесь рождается концепция">
            <textarea style={{...taStyle, minHeight: 100}} value={d.styleStory ?? ""}
                      onChange={e => set("styleStory", e.target.value)}/>
        </Field>
        <Field label="Ссылки на референсы" hint="Ссылки на Pinterest, Behance, Instagram — то, что нравится"><input
            style={inputStyle} placeholder="https://pin.it/..., https://behance.net/..." value={d.references ?? ""}
            onChange={e => set("references", e.target.value)}/></Field>
        <Field label="Антиреференсы" hint="Примеры того, что категорически не подходит"><input style={inputStyle}
                                                                                               placeholder="Слишком холодный минимализм, тяжёлая классика"
                                                                                               value={d.antiReferences ?? ""}
                                                                                               onChange={e => set("antiReferences", e.target.value)}/></Field>
    </>
}

function StepBudget({d, set}: { d: D; set: (k: string, v: string) => void }) {
    return <>
        <Field label="Что включает бюджет?" required hint="Определите, что входит в стоимость проекта"><Select
            value={d.budgetScope ?? ""} options={BUDGET_SCOPE} onChange={v => set("budgetScope", v)}/></Field>
        <Field label="Бюджет на строительство / реализацию"
               hint="Общая сумма на реализацию (без дизайн-проекта)"><Select value={d.budgetRange ?? ""}
                                                                             options={BUDGET_RANGE}
                                                                             onChange={v => set("budgetRange", v)}/></Field>
        <Field label="Бюджет на отделку руб./м²" hint="Стоимость отделки за квадратный метр"><Select
            value={d.sqmBudget ?? ""} options={SQM_BUDGET} onChange={v => set("sqmBudget", v)}/></Field>
        <Field label="Гибкость бюджета" hint="Насколько возможно отклонение от заявленного бюджета"><Select
            value={d.budgetFlex ?? ""} options={BUDGET_FLEX} onChange={v => set("budgetFlex", v)}/></Field>
        <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem"}}>
            <Field label="Срок дизайн-проекта" hint="Когда нужен готовый проект"><input type="date" style={inputStyle}
                                                                                        value={d.deadlineDesign ?? ""}
                                                                                        onChange={e => set("deadlineDesign", e.target.value)}/></Field>
            <Field label="Желаемое открытие" required hint="Дата, к которой объект должен быть готов"><input type="date"
                                                                                                             style={inputStyle}
                                                                                                             value={d.deadlineOpen ?? ""}
                                                                                                             onChange={e => set("deadlineOpen", e.target.value)}/></Field>
        </div>
        <Field label="Что важнее: качество или срок?" hint="Поможет дизайнеру расставить приоритеты"><Select
            value={d.priority ?? ""} options={PRIORITY} onChange={v => set("priority", v)}/></Field>
        <Field label="Когда готовы начать?" hint="Когда можно приступить к работе"><Select value={d.startReady ?? ""}
                                                                                           options={START_READY}
                                                                                           onChange={v => set("startReady", v)}/></Field>
    </>
}

function StepFiles({
                       d,
                       set,
                       briefFiles,
                       onRefreshFiles,
                       onUploadFiles,
                       onDeleteFile,
                       briefVideo,
                       onUploadVideo,
                       uploading,
                   }: {
    d: D
    set: (k: string, v: string) => void
    briefFiles: {
        id: string;
        s3Key: string;
        filename: string;
        mimeType: string | null;
        size: number | null;
        createdAt: string
    }[]
    onRefreshFiles: () => void
    onUploadFiles: (files: File[]) => void
    onDeleteFile: (fileId: string) => void
    briefVideo: { id: string; s3Key: string; filename: string; mimeType: string | null; createdAt: string } | null
    onUploadVideo: (file: File) => void
    uploading: boolean
}) {
    const filesInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)
    const [filesUploadPct, setFilesUploadPct] = useState<number | null>(null)

    const formatSize = (bytes: number | null): string => {
        if (!bytes || !Number.isFinite(bytes)) return "—"
        if (bytes < 1024) return `${bytes} Б`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
        return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
    }

    const outlineBtnStyle: React.CSSProperties = {
        border: "1px solid var(--dash-border)",
        background: "var(--dash-surface2)",
        color: "var(--dash-text)",
    }
    const dangerBtnStyle: React.CSSProperties = {
        border: "1px solid rgba(239, 68, 68, 0.55)",
        background: "rgba(239, 68, 68, 0.12)",
        color: "rgba(239, 68, 68, 0.95)",
    }

    return <>
        <p style={{fontSize: "0.85rem", color: "var(--dash-muted)", marginBottom: "1.5rem"}}>
            Загрузите имеющиеся документы. Чем больше контекста — тем точнее первая встреча.
        </p>

        <Field
            label="Документы к брифу (массовая загрузка)"
            hint="PDF, DWG, DXF, JPG, PNG, ZIP, RAR, MP4, WEBM, MOV — до 500МБ за файл. Можно перетаскивать пачкой."
        >
            <input
                ref={filesInputRef}
                type="file"
                multiple
                style={{display: "none"}}
                disabled={uploading}
                onChange={(e) => {
                    const list = Array.from(e.target.files ?? [])
                    e.target.value = ""
                    if (list.length) onUploadFiles(list)
                }}
            />

            <div
                onClick={() => filesInputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const list = Array.from(e.dataTransfer.files ?? [])
                    if (list.length) onUploadFiles(list)
                }}
                style={{
                    cursor: uploading ? "default" : "pointer",
                    border: "1.5px dashed var(--dash-border)",
                    borderColor: dragOver ? "var(--dash-accent)" : "var(--dash-border)",
                    background: dragOver ? "var(--dash-accent-bg)" : "transparent",
                    borderRadius: 12,
                    padding: "16px 14px",
                    userSelect: "none",
                    opacity: uploading ? 0.75 : 1,
                }}
                aria-disabled={uploading}
            >
                <div style={{display: "flex", alignItems: "center", gap: 10}}>
                    <i className="bx bx-cloud-upload" style={{fontSize: "1.4rem", color: "var(--dash-muted)"}}/>
                    <div style={{minWidth: 0}}>
                        <div style={{fontSize: "0.85rem", fontWeight: 600, color: "var(--dash-text)"}}>
                            Нажмите или перетащите файлы сюда
                        </div>
                        <div style={{fontSize: "0.74rem", color: "var(--dash-muted)", marginTop: 2}}>
                            {uploading ? "Идет загрузка…" : "Можно выбрать сразу несколько файлов"}
                            {filesUploadPct != null ? ` · ${filesUploadPct}%` : ""}
                        </div>
                    </div>
                </div>
            </div>

            {briefFiles.length > 0 ? (
                <div style={{marginTop: 10, display: "grid", gap: 8}}>
                    {briefFiles.map((f) => (
                        <div
                            key={f.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--dash-border)",
                                background: "var(--dash-surface)",
                            }}
                        >
                            <div style={{display: "flex", alignItems: "center", gap: 8, minWidth: 0}}>
                                <i className="bx bx-file" style={{color: "var(--dash-accent)"}}/>
                                <div style={{minWidth: 0}}>
                                    <div style={{
                                        fontSize: "0.82rem",
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        {f.filename}
                                    </div>
                                    <div style={{fontSize: "0.72rem", color: "var(--dash-muted)"}}>
                                        {formatSize(f.size)}
                                    </div>
                                </div>
                            </div>
                            <div style={{display: "flex", alignItems: "center", gap: 10, flexShrink: 0}}>
                                <a
                                    href={`/api/files/download?key=${encodeURIComponent(f.s3Key)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{color: "var(--dash-accent)", textDecoration: "none", fontSize: "0.78rem"}}
                                >
                                    Скачать
                                </a>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={uploading}
                                    style={dangerBtnStyle}
                                    onClick={() => {
                                        if (!confirm("Удалить файл из брифа?")) return
                                        onDeleteFile(f.id)
                                    }}
                                >
                                    Удалить
                                </Button>
                            </div>
                        </div>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={onRefreshFiles}
                        style={{...outlineBtnStyle, alignSelf: "flex-start"}}
                    >
                        Обновить список
                    </Button>
                </div>
            ) : (
                <div style={{marginTop: 10, fontSize: "0.78rem", color: "var(--dash-muted)"}}>
                    Пока нет прикрепленных файлов.
                </div>
            )}
        </Field>

        <Field label="Видео к брифу (опционально)"
               hint="Коротко покажите пространство и расскажите задачи. Формат: mp4/webm/mov, до 50МБ">
            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                <input
                    type="file"
                    accept="video/*"
                    style={{display: "none"}}
                    ref={videoInputRef}
                    disabled={uploading}
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) onUploadVideo(f)
                    }}
                />
                <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                        videoInputRef.current?.click()
                    }}
                    style={{...outlineBtnStyle, alignSelf: "flex-start"}}
                >
                    Выбрать видео
                </Button>
                {briefVideo?.s3Key && (
                    <div style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--dash-border)",
                        background: "var(--dash-surface)"
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 8
                        }}>
                            <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <i className="bx bx-video" style={{color: "var(--dash-accent)"}}/>
                                <div>
                                    <div style={{fontSize: "0.82rem", fontWeight: 600}}>Прикреплено</div>
                                    <div style={{
                                        fontSize: "0.75rem",
                                        color: "var(--dash-muted)"
                                    }}>{briefVideo.filename}</div>
                                </div>
                            </div>
                            <a
                                href={`/api/files/download?key=${encodeURIComponent(briefVideo.s3Key)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{color: "var(--dash-accent)", textDecoration: "none", fontSize: "0.78rem"}}
                            >
                                Скачать
                            </a>
                        </div>
                        <video
                            src={`/api/files/download?key=${encodeURIComponent(briefVideo.s3Key)}`}
                            controls
                            style={{width: "100%", maxHeight: 260, borderRadius: 10, background: "rgba(0,0,0,0.6)"}}
                        />
                    </div>
                )}
            </div>
        </Field>

        <Field label="Сохраняемые элементы / ограничения"
               hint="Что нельзя менять: несущие стены, вентиляция, существующая мебель"><textarea style={taStyle}
                                                                                                  placeholder="Несущая стена между залом и кухней, вентиляционный короб"
                                                                                                  value={d.constraints ?? ""}
                                                                                                  onChange={e => set("constraints", e.target.value)}/></Field>
        <Field label="Особые требования" hint="Нормативы, доступная среда, пожарная безопасность, акустика"><textarea
            style={taStyle} placeholder="Доступная среда для МГН, пожарные нормы для ресторана"
            value={d.specialReqs ?? ""} onChange={e => set("specialReqs", e.target.value)}/></Field>
        <Field label="Что еще важно знать дизайнеру?" hint="Любая информация, которая поможет в работе"><textarea
            style={{...taStyle, minHeight: 100}} placeholder="Планируем расширение через год, нужна модульная мебель"
            value={d.additionalComments ?? ""} onChange={e => set("additionalComments", e.target.value)}/></Field>
    </>
}

function StepReview({d}: { d: D }) {
    const row = (key: string, label: string, val?: string) => val ? (
        <div
            key={key}
            style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "6px 0",
                borderBottom: "1px solid var(--dash-border)",
                fontSize: "0.82rem"
            }}
        >
            <span style={{color: "var(--dash-muted)", flexShrink: 0}}>{label}</span>
            <span style={{color: "var(--dash-text)", textAlign: "right"}}>{val}</span>
        </div>
    ) : null

    return <>
        {ADMIN_BRIEF_FIELD_GROUPS.map(group => {
            const filled = group.fields.filter(f => d[f.key]?.trim())
            if (!filled.length) return null
            return (
                <div key={group.label} style={{marginBottom: 16}}>
                    <h3 style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--dash-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        margin: "0 0 6px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                    }}>
                        <i className={`bx ${group.icon}`} style={{fontSize: "0.9rem"}}/>{group.label}
                    </h3>
                    {filled.map(f => row(f.key, f.label, d[f.key]))}
                </div>
            )
        })}
        {!ADMIN_BRIEF_FIELD_GROUPS.flatMap(g => g.fields).some(f => d[f.key]?.trim()) && (
            <p style={{color: "var(--dash-muted)", fontSize: "0.85rem"}}>Ни одно поле не заполнено.</p>
        )}
    </>
}

// ── Main ──

export default function NewOrderPage() {
    const router = useRouter()
    const {data: session} = useSession()
    const sessionEmail = session?.user?.email?.trim() ?? ""
    const [orderId, setOrderId] = useState<string | null>(null)
    const [step, setStep] = useState(0)
    const [data, setData] = useState<D>({})
    const [briefVideo, setBriefVideo] = useState<{
        id: string;
        s3Key: string;
        filename: string;
        mimeType: string | null;
        createdAt: string
    } | null>(null)
    const [briefFiles, setBriefFiles] = useState<{
        id: string;
        s3Key: string;
        filename: string;
        mimeType: string | null;
        size: number | null;
        createdAt: string
    }[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [agreed, setAgreed] = useState(false)
    const [toast, setToast] = useState<string | null>(null)
    const [bootError, setBootError] = useState<string | null>(null)
    const [helpRequested, setHelpRequested] = useState(false)
    const [confirmHelp, setConfirmHelp] = useState(false)
    const [showHelpHint, setShowHelpHint] = useState(false)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3500)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        if (!orderId || helpRequested) {
            setShowHelpHint(false)
            return
        }
        const t = setTimeout(() => setShowHelpHint(true), 3000)
        return () => clearTimeout(t)
    }, [orderId, helpRequested])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch("/api/orders")
                if (res.ok) {
                    const orders = await res.json()
                    const list = Array.isArray(orders) ? orders : []
                    const draft = list.find((o: { status: string }) => o.status === "DRAFT")
                    if (draft && !cancelled) {
                        setOrderId(draft.id)
                        setData(normalizeBriefData(draft.briefData))
                        setStep(typeof draft.briefStep === "number" ? draft.briefStep : 0)
                        setHelpRequested(Boolean(draft.briefHelpRequested))
                        try {
                            const vr = await fetch(`/api/orders/${draft.id}/brief/video`)
                            if (vr.ok) {
                                const body = await vr.json() as { file: typeof briefVideo }
                                if (!cancelled) setBriefVideo(body.file ?? null)
                            }
                        } catch {
                            // ignore
                        }
                        try {
                            const fr = await fetch(`/api/orders/${draft.id}/brief/files`)
                            if (fr.ok) {
                                const body = await fr.json() as { files?: typeof briefFiles }
                                if (!cancelled) setBriefFiles(Array.isArray(body.files) ? body.files : [])
                            }
                        } catch {
                            // ignore
                        }
                        return
                    }
                }
                const cr = await fetch("/api/orders", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({})
                })
                if (!cr.ok) {
                    if (!cancelled) {
                        const msg =
                            cr.status === 401
                                ? "Войдите в кабинет клиента"
                                : cr.status === 403
                                    ? (await cr.json().catch(() => ({})) as { message?: string }).message?.trim() ||
                                    "Создание проекта недоступно"
                                    : "Не удалось создать черновик заказа"
                        setBootError(msg)
                    }
                    return
                }
                const o = await cr.json()
                if (!cancelled) setOrderId(o.id)
            } catch {
                if (!cancelled) setBootError("Ошибка сети при создании черновика")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const uploadBriefVideo = async (file: File) => {
        if (!orderId) return
        setSaving(true)
        setError(null)
        try {
            const fd = new FormData()
            fd.append("file", file)
            const res = await fetch(`/api/orders/${orderId}/brief/video`, {method: "POST", body: fd})
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string }
                setError(err.error || "Не удалось загрузить видео")
                return
            }
            const body = await res.json() as { file: typeof briefVideo }
            setBriefVideo(body.file ?? null)
            setToast("Видео прикреплено к брифу")
        } catch {
            setError("Ошибка сети при загрузке видео")
        } finally {
            setSaving(false)
        }
    }

    const refreshBriefFiles = useCallback(async () => {
        if (!orderId) return
        try {
            const r = await fetch(`/api/orders/${orderId}/brief/files`)
            if (!r.ok) return
            const body = await r.json() as { files?: typeof briefFiles }
            setBriefFiles(Array.isArray(body.files) ? body.files : [])
        } catch {
            // ignore
        }
    }, [orderId])

    const uploadBriefFiles = useCallback(async (files: File[]) => {
        if (!orderId) return
        if (files.length === 0) return
        setSaving(true)
        setError(null)
        try {
            const fd = new FormData()
            for (const f of files.slice(0, 30)) fd.append("files", f)
            const res = await fetch(`/api/orders/${orderId}/brief/files`, {method: "POST", body: fd})
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string }
                setError(err.error || "Не удалось загрузить файлы")
                return
            }
            const body = await res.json() as { files?: typeof briefFiles }
            if (Array.isArray(body.files)) {
                // prepend new files
                setBriefFiles((prev) => [...body.files!, ...prev])
            } else {
                await refreshBriefFiles()
            }
            setToast("Файлы прикреплены к брифу")
        } catch {
            setError("Ошибка сети при загрузке файлов")
        } finally {
            setSaving(false)
        }
    }, [orderId, refreshBriefFiles])

    const deleteBriefFile = useCallback(async (fileId: string) => {
        if (!orderId) return
        setSaving(true)
        setError(null)
        try {
            const r = await fetch(`/api/orders/${orderId}/brief/files?fileId=${encodeURIComponent(fileId)}`, {method: "DELETE"})
            if (!r.ok) {
                const err = await r.json().catch(() => ({})) as { error?: string }
                setError(err.error || "Не удалось удалить файл")
                return
            }
            setBriefFiles((prev) => prev.filter((f) => f.id !== fileId))
            setToast("Файл удален")
        } catch {
            setError("Ошибка сети при удалении файла")
        } finally {
            setSaving(false)
        }
    }, [orderId])

    const set = (k: string, v: string) => setData(p => ({...p, [k]: v}))
    const toggle = (field: string, val: string) => {
        const cur = (data[field] ?? "").split(",").map(s => s.trim()).filter(Boolean)
        set(field, (cur.includes(val) ? cur.filter(s => s !== val) : [...cur, val]).join(", "))
    }

    const REQUIRED_BY_STEP: string[][] = [
        ["objectType", "companySegment", "objAddress", "objStage", "objArea"], // 0: Объект
        ["taskMain", "targetAudience"],                                        // 1: Задачи
        [],                                                                    // 2: Стиль
        ["budgetScope", "deadlineOpen"],                                       // 3: Бюджет
        [],                                                                    // 4: Материалы
        [],                                                                    // 5: Итог
    ]
    const isStepValid = (s: number) => (REQUIRED_BY_STEP[s] ?? []).every(k => (data[k] ?? "").trim() !== "")

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dRef = useRef(data);
    dRef.current = data
    const sRef = useRef(step);
    sRef.current = step
    const orderIdRef = useRef<string | null>(null)
    orderIdRef.current = orderId

    const doSave = useCallback(async () => {
        const id = orderIdRef.current
        if (!id) return
        setSaving(true)
        try {
            await fetch(`/api/orders/${id}/brief`, {
                method: "PATCH", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({...dRef.current, _briefStep: sRef.current}),
            })
        } finally {
            setSaving(false)
        }
    }, [])

    const flushSave = useCallback(async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        await doSave()
    }, [doSave])

    useEffect(() => {
        if (!orderId) return
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            void doSave();
            timerRef.current = null
        }, 1500)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [data, step, orderId, doSave])

    useEffect(() => {
        const flush = () => {
            const id = orderIdRef.current
            if (!id) return
            const body = JSON.stringify({...dRef.current, _briefStep: sRef.current})
            void fetch(`/api/orders/${id}/brief`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body,
                keepalive: true,
            })
        }
        const onVis = () => {
            if (document.visibilityState === "hidden") flush()
        }
        document.addEventListener("visibilitychange", onVis)
        window.addEventListener("beforeunload", flush)
        return () => {
            document.removeEventListener("visibilitychange", onVis)
            window.removeEventListener("beforeunload", flush)
        }
    }, [])

    const handleSubmit = async () => {
        if (!orderId || !agreed) return
        setSubmitting(true);
        setError(null)
        try {
            await flushSave()
            const res = await fetch(`/api/orders/${orderId}/brief/submit`, {method: "POST"})
            if (res.status === 403) {
                const body = (await res.json().catch(() => ({}))) as { message?: string }
                throw new Error(body.message ?? "Нужно подписать договор оказания услуг")
            }
            if (!res.ok) throw new Error("Ошибка отправки")
            router.push(`/orders/${orderId}`)
        } catch {
            setError("Не удалось отправить. Попробуйте еще раз.");
            setSubmitting(false)
        }
    }

    const pct = (step / (STEPS.length - 1)) * 100

    return (
        <div className="dash">
            {!bootError && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    zIndex: 200,
                    background: "var(--dash-border)"
                }}>
                    <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "var(--dash-accent)",
                        transition: "width 0.3s"
                    }}/>
                </div>
            )}

            <DashTopHeader
                email={sessionEmail}
                title="Новый бриф"
                logoHref={CLIENT_CABINET_LOGO_HREF}
                navItems={buildClientCabinetNavItems("orders")}
                primaryAction={{href: "/orders", label: "К проектам", iconClassName: "bx bx-grid-alt"}}
            />

            <div className="dash-body" style={{padding: 0}}>
                <main className="dash-main" style={{display: "flex", flexDirection: "column", minHeight: 0}}>
                    {bootError && (
                        <div
                            className="dash-main__scroll"
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                flex: 1,
                                padding: "2rem 1rem",
                            }}
                        >
                            <DashSurfaceCard className="dash-surface-card--pad-lg"
                                             style={{maxWidth: 480, width: "100%"}}>
                                <p style={{
                                    margin: 0,
                                    color: "var(--dash-danger)",
                                    fontSize: "0.88rem",
                                    lineHeight: 1.5
                                }}>{bootError}</p>
                                <Link href="/orders?tab=payments" style={{
                                    display: "inline-block",
                                    marginTop: 16,
                                    color: "var(--dash-accent)",
                                    fontWeight: 600
                                }}>
                                    Открыть кабинет →
                                </Link>
                            </DashSurfaceCard>
                        </div>
                    )}

                    {!bootError && (
                        <>
                            {/* Step nav */}
                            <DashSurfaceCard style={{
                                borderRadius: 0,
                                borderLeft: "none",
                                borderRight: "none",
                                overflowX: "auto",
                                padding: "0 1.5rem",
                                display: "flex",
                                justifyContent: "center"
                            }}>
                                <div style={{display: "flex", gap: 0}}>
                                    {STEPS.map((s, i) => (
                                        <button key={s.key} type="button" onClick={() => {
                                            if (!(i <= step || isStepValid(step))) return
                                            void flushSave().then(() => setStep(i))
                                        }} style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "0.85rem 1rem",
                                            fontSize: "0.82rem",
                                            fontFamily: "inherit",
                                            cursor: "pointer",
                                            whiteSpace: "nowrap",
                                            border: "none",
                                            borderBottomWidth: 2,
                                            borderBottomStyle: "solid",
                                            borderBottomColor: i === step ? "var(--dash-accent)" : "transparent",
                                            color: i === step ? "var(--dash-accent)" : i < step ? "var(--dash-success, #2d6a2d)" : "var(--dash-muted)",
                                            fontWeight: i === step ? 600 : 400,
                                            background: "none",
                                        }}>
                  <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      background: i < step ? "var(--dash-success, #2d6a2d)" : "var(--dash-surface2)",
                      color: i < step ? "#fff" : "var(--dash-muted)",
                  }}>{i < step ? "✓" : i + 1}</span>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </DashSurfaceCard>

                            <div className="dash-main__scroll"
                                 style={{display: "flex", justifyContent: "center", flex: 1, minHeight: 0}}>
                                <div style={{maxWidth: 640, width: "100%", padding: "2rem 1rem 4rem"}}>
                                    <div
                                        style={{
                                            marginBottom: "1.5rem",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                            gap: "1rem",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <DashPageTitle subtitle={`Шаг ${step + 1} из ${STEPS.length}`}>
                                            {STEPS[step].label}
                                        </DashPageTitle>
                                        {orderId && step < STEPS.length - 1 ? (
                                            <BriefWizardAIDrawer briefData={data} stepKey={STEPS[step].key}
                                                                 onApply={(field, value) => set(field, value)}/>
                                        ) : null}
                                    </div>

                                    <DashSurfaceCard className="dash-surface-card--pad-lg dash-surface-card--mb">
                                        {step === 0 && <StepObject d={data} set={set}/>}
                                        {step === 1 && <StepTasks d={data} set={set} toggle={toggle}/>}
                                        {step === 2 && <StepStyle d={data} set={set} toggle={toggle}/>}
                                        {step === 3 && <StepBudget d={data} set={set}/>}
                                        {step === 4 && (
                                            <StepFiles
                                                d={data}
                                                set={set}
                                                briefFiles={briefFiles}
                                                onRefreshFiles={refreshBriefFiles}
                                                onUploadFiles={uploadBriefFiles}
                                                onDeleteFile={deleteBriefFile}
                                                briefVideo={briefVideo}
                                                onUploadVideo={uploadBriefVideo}
                                                uploading={saving}
                                            />
                                        )}
                                        {step === 5 && (
                                            <>
                                                <StepReview d={data}/>
                                                <label style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 8,
                                                    marginTop: 20,
                                                    fontSize: "0.82rem",
                                                    color: "var(--dash-text2)",
                                                    cursor: "pointer"
                                                }}>
                                                    <input type="checkbox" checked={agreed}
                                                           onChange={e => setAgreed(e.target.checked)}
                                                           style={{marginTop: 3}}/>
                                                    <span>
                        Я согласен с{" "}
                                                        <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                                                              style={{
                                                                  color: "var(--dash-accent)",
                                                                  textDecoration: "underline"
                                                              }}>
                          политикой конфиденциальности NEXUS и обработкой персональных данных
                        </Link>
                      </span>
                                                </label>
                                            </>
                                        )}
                                    </DashSurfaceCard>

                                    {bootError && (
                                        <div style={{
                                            background: "var(--dash-danger-bg)",
                                            border: "1px solid var(--dash-danger)",
                                            borderRadius: 10,
                                            padding: "0.75rem 1rem",
                                            marginBottom: "1rem",
                                            color: "var(--dash-danger)",
                                            fontSize: "0.82rem"
                                        }}>{bootError}</div>
                                    )}

                                    {error && (
                                        <div style={{
                                            background: "var(--dash-danger-bg)",
                                            border: "1px solid var(--dash-danger)",
                                            borderRadius: 10,
                                            padding: "0.75rem 1rem",
                                            marginBottom: "1rem",
                                            color: "var(--dash-danger)",
                                            fontSize: "0.82rem"
                                        }}>{error}</div>
                                    )}

                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        <button type="button" onClick={() => {
                                            void flushSave().then(() => setStep(s => s - 1))
                                        }} disabled={step === 0} style={{
                                            padding: "0.65em 1.5em",
                                            border: "1px solid var(--dash-border)",
                                            borderRadius: 8,
                                            background: "transparent",
                                            color: step === 0 ? "var(--dash-muted)" : "var(--dash-text)",
                                            fontSize: "0.85rem",
                                            fontWeight: 500,
                                            cursor: step === 0 ? "default" : "pointer",
                                            fontFamily: "inherit",
                                            visibility: step === 0 ? "hidden" : "visible",
                                        }}>← Назад
                                        </button>

                                        <button
                                            type="button"
                                            disabled={!orderId || helpRequested}
                                            onClick={async () => {
                                                if (!orderId) return
                                                if (!confirm("Отправить запрос менеджеру? Он свяжется с вами и поможет заполнить бриф.")) return
                                                setSaving(true)
                                                try {
                                                    await fetch(`/api/orders/${orderId}/brief`, {
                                                        method: "PATCH", headers: {"Content-Type": "application/json"},
                                                        body: JSON.stringify({
                                                            ...dRef.current,
                                                            _briefStep: sRef.current,
                                                            _briefHelpRequested: true
                                                        }),
                                                    })
                                                    setHelpRequested(true)
                                                    setToast("Менеджер свяжется с вами и поможет заполнить бриф")
                                                } finally {
                                                    setSaving(false)
                                                }
                                            }}
                                            style={{
                                                padding: "0.5em 1em",
                                                borderRadius: 8,
                                                border: helpRequested ? "1px solid var(--dash-success)" : "1px solid var(--dash-accent-border)",
                                                background: helpRequested ? "var(--dash-success-bg)" : "transparent",
                                                color: helpRequested ? "var(--dash-success)" : "var(--dash-accent)",
                                                fontSize: "0.78rem",
                                                fontWeight: 500,
                                                cursor: !orderId || helpRequested ? "default" : "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            <i className={`bx ${helpRequested ? "bx-check" : "bx-support"}`}
                                               style={{marginRight: 4, verticalAlign: "middle"}}/>
                                            {helpRequested ? "Менеджер уведомлен" : "Нужна помощь менеджера"}
                                        </button>

                                        {step < STEPS.length - 1 ? (
                                            <button type="button" onClick={() => {
                                                if (!orderId || !isStepValid(step)) return;
                                                void flushSave().then(() => setStep(s => s + 1))
                                            }} style={{
                                                padding: "0.65em 2em",
                                                borderRadius: 8,
                                                border: "none",
                                                fontSize: "0.85rem",
                                                fontWeight: 600,
                                                fontFamily: "inherit",
                                                background: orderId && isStepValid(step) ? "var(--dash-accent)" : "var(--dash-border)",
                                                color: orderId && isStepValid(step) ? "#fff" : "var(--dash-muted)",
                                                cursor: orderId && isStepValid(step) ? "pointer" : "default",
                                            }}>Продолжить →</button>
                                        ) : (
                                            <button type="button" onClick={handleSubmit}
                                                    disabled={submitting || !agreed || !orderId} style={{
                                                padding: "0.65em 2em",
                                                borderRadius: 8,
                                                border: "none",
                                                fontSize: "0.85rem",
                                                fontWeight: 600,
                                                fontFamily: "inherit",
                                                background: agreed && orderId ? "var(--dash-accent)" : "var(--dash-border)",
                                                color: agreed && orderId ? "#fff" : "var(--dash-muted)",
                                                cursor: submitting || !agreed || !orderId ? "default" : "pointer",
                                                opacity: submitting ? 0.7 : 1,
                                            }}>{submitting ? "Отправляем…" : "Отправить бриф →"}</button>
                                        )}
                                    </div>

                                    <ClientDashFooter/>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Floating help — всегда видна; до появления orderId недоступна */}
            {!bootError && orderId && !helpRequested && (
                <div
                    style={{
                        position: "fixed",
                        right: 24,
                        bottom: 96,
                        zIndex: 55,
                        color: "var(--dash-text)",
                        border: "1px solid var(--dash-border)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontSize: "0.78rem",
                        lineHeight: 1.3,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.24)",
                        maxWidth: 230,
                        opacity: showHelpHint ? 1 : 0,
                        transform: showHelpHint ? "translateY(0)" : "translateY(6px)",
                        transition: "opacity 0.35s ease, transform 0.35s ease",
                        pointerEvents: "none",
                    }}
                >
                    Нажмите, если нужна помощь менеджера
                    <span
                        style={{
                            position: "absolute",
                            right: 20,
                            bottom: -8,
                            width: 14,
                            height: 14,
                            background: "rgba(20, 25, 40, 0.92)",
                            borderRight: "1px solid var(--dash-border)",
                            borderBottom: "1px solid var(--dash-border)",
                            transform: "rotate(45deg)",
                        }}
                    />
                </div>
            )}
            <button
                type="button"
                disabled={Boolean(bootError) || !orderId || helpRequested}
                onClick={async () => {
                    const id = orderIdRef.current
                    if (!id) return
                    if (!confirmHelp) {
                        setConfirmHelp(true)
                        setToast("Нажмите еще раз, чтобы отправить запрос менеджеру")
                        return
                    }
                    if (timerRef.current) {
                        clearTimeout(timerRef.current)
                        timerRef.current = null
                    }
                    setSaving(true)
                    try {
                        await fetch(`/api/orders/${id}/brief`, {
                            method: "PATCH", headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                ...dRef.current,
                                _briefStep: sRef.current,
                                _briefHelpRequested: true
                            }),
                        })
                        setHelpRequested(true)
                        setConfirmHelp(false)
                        setToast("Менеджер свяжется с вами и поможет заполнить бриф")
                    } finally {
                        setSaving(false)
                    }
                }}
                onBlur={() => setConfirmHelp(false)}
                title={
                    !orderId
                        ? "Создается черновик…"
                        : helpRequested
                            ? "Запрос уже отправлен"
                            : confirmHelp
                                ? "Подтвердите отправку запроса"
                                : "Запросить помощь менеджера"
                }
                aria-label="Помощь менеджера"
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 50,
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: !orderId || helpRequested ? "var(--dash-border)" : confirmHelp ? "var(--dash-warn)" : "var(--dash-accent)",
                    color: !orderId || helpRequested ? "var(--dash-muted)" : "#fff",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    cursor: !orderId || helpRequested ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                    transition: "transform 0.2s",
                    opacity: !orderId ? 0.85 : 1,
                }}
                onMouseEnter={e => {
                    if (orderId && !helpRequested) e.currentTarget.style.transform = "scale(1.1)"
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)"
                }}
            >
                <i className={`bx ${helpRequested ? "bx-check-circle" : confirmHelp ? "bx-error" : "bx-help-circle"}`}/>
            </button>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", bottom: 88, right: 24, zIndex: 60,
                    background: "var(--dash-surface, #fff)", border: "1px solid var(--dash-border)",
                    borderRadius: 10, padding: "0.75rem 1.25rem", boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                    display: "flex", alignItems: "center", gap: 10, fontSize: "0.84rem", color: "var(--dash-text)",
                    animation: "toast-in 0.3s ease",
                }}>
                    <i className="bx bx-check-circle"
                       style={{color: "var(--dash-success, #2d6a2d)", fontSize: "1.2rem"}}/>
                    {toast}
                </div>
            )}
            <style>{`@keyframes toast-in { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
        </div>
    )
}
