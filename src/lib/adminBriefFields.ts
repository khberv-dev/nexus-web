/** Схема полей брифа (мастер /orders/new) — для админки: обзор и BriefEditor */

export type AdminBriefField = {
    key: string
    label: string
    type?: "text" | "textarea" | "select" | "chips" | "date" | "number"
    options?: string[]
}
export type AdminBriefFieldGroup = { label: string; icon: string; fields: AdminBriefField[] }

const OBJECT_TYPES = ["Офис", "Ресторан / кафе", "Ретейл", "Шоурум", "Фитнес / спа", "Гостиница", "Медицинский центр", "Другое"]
const OBJ_STAGES = ["Проектирование", "Строительство", "Ремонт / реконструкция", "Готовый объект"]
const TASKS = ["Планировочное решение", "Дизайн-концепция", "3D-визуализация", "Рабочая документация", "Авторский надзор", "Подбор мебели и материалов", "Брендинг пространства", "Световой дизайн", "Акустический дизайн", "Ландшафт / терраса"]
const STYLES = ["Современный минимализм", "Нео-классика", "Арт-деко", "Индустриальный / loft", "Скандинавский", "Японский / ваби-саби", "Бохо / органика", "Биофильный дизайн", "Эклектика", "Без четких предпочтений"]
const LIGHTING = ["Теплый свет, интимная атмосфера", "Нейтральный свет, баланс тепла и холода", "Яркий дневной свет (4000–6000 K)", "Акцентное зональное освещение", "Максимум естественного света", "Динамическое (Human Centric Lighting)"]
const BUDGET_SCOPE = ["Только дизайн-проект (документация)", "Дизайн + авторский надзор", "Дизайн + строительство «под ключ»", "Только строительство (проект уже есть)", "Пока не определился"]
const BUDGET_RANGE = ["До 5 млн руб.", "5–15 млн руб.", "15–30 млн руб.", "30–60 млн руб.", "60–150 млн руб.", "150–500 млн руб.", "Более 500 млн руб.", "Предпочитаю не указывать"]
const SQM_BUDGET = ["До 30 000 руб./м² — эконом", "30 000–60 000 руб./м² — стандарт", "60 000–120 000 руб./м² — бизнес", "120 000–250 000 руб./м² — премиум", "Более 250 000 руб./м² — luxury"]
const BUDGET_FLEX = ["Жесткий бюджет, отклонение невозможно", "Допустимо отклонение до 10% при обосновании", "Бюджет гибкий при убедительном решении", "Приоритет — результат, бюджет вторичен"]
const PRIORITY = ["Срок жесткий — есть привязка к событию / договору", "Готов сдвинуть срок ради качества результата", "Равнозначно важны оба параметра"]
const START_READY = ["Немедленно", "В течение 2 недель", "В течение месяца", "Через 1–3 месяца", "Пока изучаю рынок"]

export const ADMIN_BRIEF_FIELD_GROUPS: AdminBriefFieldGroup[] = [
    {
        label: "Объект",
        icon: "bx-building",
        fields: [
            {key: "objectType", label: "Тип объекта", type: "select", options: OBJECT_TYPES},
            {key: "companySegment", label: "Сегмент бизнеса"},
            {key: "companyDesc", label: "Описание бизнеса", type: "textarea"},
            {key: "objAddress", label: "Адрес объекта"},
            {key: "objStage", label: "Стадия объекта", type: "select", options: OBJ_STAGES},
            {key: "objArea", label: "Площадь, м²", type: "number"},
            {key: "objFloors", label: "Этажей", type: "number"},
            {key: "objDesc", label: "Описание объекта", type: "textarea"},
        ],
    },
    {
        label: "Задачи",
        icon: "bx-task",
        fields: [
            {key: "tasks", label: "Задачи проекта", type: "chips", options: TASKS},
            {key: "taskMain", label: "Главная цель"},
            {key: "targetAudience", label: "Целевая аудитория", type: "textarea"},
            {key: "competitors", label: "Конкуренты / референсы", type: "textarea"},
            {key: "currentProblem", label: "Что не устраивает", type: "textarea"},
        ],
    },
    {
        label: "Стиль",
        icon: "bx-palette",
        fields: [
            {key: "styleDir", label: "Стилевое направление", type: "chips", options: STYLES},
            {key: "colorPalette", label: "Цветовая гамма"},
            {key: "colorAvoid", label: "Нежелательные цвета"},
            {key: "lightingPref", label: "Освещение", type: "select", options: LIGHTING},
            {key: "materials", label: "Материалы"},
            {key: "styleStory", label: "Образ пространства", type: "textarea"},
            {key: "references", label: "Референсы"},
            {key: "antiReferences", label: "Антиреференсы"},
        ],
    },
    {
        label: "Бюджет и сроки",
        icon: "bx-wallet",
        fields: [
            {key: "budgetScope", label: "Состав бюджета", type: "select", options: BUDGET_SCOPE},
            {key: "budgetRange", label: "Бюджет", type: "select", options: BUDGET_RANGE},
            {key: "sqmBudget", label: "руб./м²", type: "select", options: SQM_BUDGET},
            {key: "budgetFlex", label: "Гибкость бюджета", type: "select", options: BUDGET_FLEX},
            {key: "deadlineDesign", label: "Срок дизайн-проекта", type: "date"},
            {key: "deadlineOpen", label: "Желаемое открытие", type: "date"},
            {key: "priority", label: "Качество или срок", type: "select", options: PRIORITY},
            {key: "startReady", label: "Готовность начать", type: "select", options: START_READY},
        ],
    },
    {
        label: "Дополнительно",
        icon: "bx-file",
        fields: [
            {key: "constraints", label: "Ограничения / сохраняемое", type: "textarea"},
            {key: "specialReqs", label: "Особые требования", type: "textarea"},
            {key: "additionalComments", label: "Комментарии дизайнеру", type: "textarea"},
        ],
    },
]

const KNOWN_KEYS = new Set(
    ADMIN_BRIEF_FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key)),
)

export function isBriefFieldValueFilled(value: unknown): boolean {
    if (value == null) return false
    const s = typeof value === "string" ? value : String(value)
    return s.trim().length > 0
}

export function adminBriefFlatFields(): (AdminBriefField & { groupLabel: string; groupIcon: string })[] {
    return ADMIN_BRIEF_FIELD_GROUPS.flatMap(g =>
        g.fields.map(f => ({...f, groupLabel: g.label, groupIcon: g.icon})),
    )
}

export function getAdminBriefCompletion(bd: Record<string, string> | null | undefined): {
    filled: number
    total: number
    rows: { key: string; label: string; groupLabel: string; groupIcon: string; filled: boolean; preview: string }[]
    extraEntries: { key: string; value: string }[]
} {
    const data = bd ?? {}
    const rows = adminBriefFlatFields().map(f => {
        const raw = data[f.key]
        const filled = isBriefFieldValueFilled(raw)
        const preview = filled ? (typeof raw === "string" ? raw : String(raw)).replace(/\s+/g, " ").trim() : ""
        return {
            key: f.key,
            label: f.label,
            groupLabel: f.groupLabel,
            groupIcon: f.groupIcon,
            filled,
            preview,
        }
    })
    const filled = rows.filter(r => r.filled).length
    const extraEntries = Object.entries(data)
        .filter(([k, v]) => !k.startsWith("_") && !KNOWN_KEYS.has(k) && isBriefFieldValueFilled(v))
        .map(([key, value]) => ({key, value: typeof value === "string" ? value : String(value)}))

    return {filled, total: rows.length, rows, extraEntries}
}
