import {adminBriefFlatFields} from "@/lib/adminBriefFields"

/** Поля старых брифов (до расширенного мастера) — показываем, если есть в данных */
const LEGACY_BRIEF_LABELS: Record<string, string> = {
    area: "Площадь",
    address: "Адрес",
    style: "Стиль",
    materials: "Материалы и цвета",
    vision: "Образ и атмосфера",
    budget: "Бюджет",
    deadline: "Срок",
    rooms: "Помещения",
    notes: "Особые требования",
}

/**
 * Подписи полей брифа в порядке мастера / админской схемы + устаревшие ключи.
 * Используется в кабинете заказчика и специалиста для отображения всех заполненных полей.
 */
export function getOrderBriefDisplayLabels(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const f of adminBriefFlatFields()) {
        out[f.key] = f.label
    }
    for (const [k, v] of Object.entries(LEGACY_BRIEF_LABELS)) {
        if (!(k in out)) out[k] = v
    }
    return out
}

const EXTRA_PLACEHOLDERS: Record<string, string> = {
    companySegment: "HoReCa, ретейл, IT…",
    companyDesc: "Чем занимается компания…",
    objAddress: "Город, улица, дом",
    objArea: "Например: 150",
    objFloors: "1",
    objDesc: "Особенности помещения…",
    taskMain: "Главная цель проекта одной строкой",
    targetAudience: "Кто будет пользоваться пространством",
    competitors: "Референсы и примеры",
    currentProblem: "Что не устраивает сейчас",
    colorPalette: "Желаемые цвета",
    colorAvoid: "Цвета, которых избегать",
    materials: "Материалы и фактуры",
    styleStory: "Образ пространства",
    references: "Ссылки или описание референсов",
    antiReferences: "Чего точно не хотите",
    deadlineDesign: "Дата",
    deadlineOpen: "Дата",
    constraints: "Нормативы, колонны, зоны без изменений…",
    specialReqs: "Особые требования",
    additionalComments: "Комментарии дизайнеру",
}

/** Плейсхолдеры для черновика на странице заказа + наследие из types */
export function getOrderBriefDisplayPlaceholders(
    legacy: Record<string, string>,
): Record<string, string> {
    return {...EXTRA_PLACEHOLDERS, ...legacy}
}
