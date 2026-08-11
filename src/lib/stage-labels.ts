import type {StageType} from "@prisma/client"

export const STAGE_LABELS_RU: Record<StageType, string> = {
    CONCEPT: "Концепция",
    PLANNING: "Планировка",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
}

export function stageLabelRu(type: StageType | string): string {
    return (STAGE_LABELS_RU as Record<string, string>)[type] ?? type
}

