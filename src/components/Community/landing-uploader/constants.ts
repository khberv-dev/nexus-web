/**
 * Требований к разрешению и формату у картинок лендинга нет: дизайнер грузит то, что есть,
 * а кадрирование делает CSS (background-size: cover) и выбор позиции кадра.
 */
export const MAX_LANDING_PORTFOLIO = 20

export const POS_OPTIONS = [
    {label: "Центр", value: "center center"},
    {label: "Верх", value: "center 20%"},
    {label: "Верх-центр", value: "center 35%"},
    {label: "Низ", value: "center 80%"},
]
