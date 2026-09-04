/**
 * Справочники для мультиселектов анкеты специалиста.
 * Значения хранятся в formData как строка со списком через запятую — формат совместим
 * с уже введённым свободным текстом ("Минимализм · Сканди", "Лофт, Индастриал").
 */

export const INTERIOR_STYLE_OPTIONS = [
    "Минимализм",
    "Современный",
    "Скандинавский",
    "Джапанди",
    "Лофт",
    "Индастриал",
    "Неоклассика",
    "Классика",
    "Ар-деко",
    "Модерн",
    "Хай-тек",
    "Бохо",
    "Прованс",
    "Кантри",
    "Средиземноморский",
    "Эко-стиль",
    "Брутализм",
    "Ваби-саби",
    "Ретро / mid-century",
    "Английский",
    "Восточный",
    "Фьюжн",
] as const

export const SPECIALTY_OPTIONS = [
    "Офисы и коворкинги",
    "Бизнес-центры",
    "Рестораны и кафе",
    "Бары и клубы",
    "Отели и апарт-отели",
    "Ритейл и магазины",
    "Шоурумы",
    "Салоны красоты",
    "Медицинские клиники",
    "Фитнес-клубы и спа",
    "Образовательные пространства",
    "Общественные пространства",
    "Жилые интерьеры",
    "Частные дома и таунхаусы",
] as const

export const METHOD_OPTIONS = [
    "Планировочные решения",
    "Рабочая документация",
    "3D-визуализация",
    "Световой дизайн",
    "Мебель на заказ",
    "Комплектация объекта",
    "Авторский надзор",
    "Ландшафтный дизайн",
] as const

/** Разделители, которые встречались в анкетах до появления мультиселекта. */
const VALUE_SEPARATORS = /[,;·|\n]/

export function parseMultiValue(raw: string | null | undefined): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const part of (raw ?? "").split(VALUE_SEPARATORS)) {
        const value = part.trim()
        if (!value) continue
        const key = value.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push(value)
    }
    return result
}

export function formatMultiValue(values: string[]): string {
    return parseMultiValue(values.join(",")).join(", ")
}

export function toggleMultiValue(raw: string | null | undefined, value: string): string {
    const current = parseMultiValue(raw)
    const key = value.trim().toLowerCase()
    const next = current.some((v) => v.toLowerCase() === key)
        ? current.filter((v) => v.toLowerCase() !== key)
        : [...current, value.trim()]
    return formatMultiValue(next)
}
