import type {HintStep} from "@/components/app/HintTour"

/**
 * Шаги подсказок кабинетов. Текст держим коротким: подсветка объясняет «где»,
 * текст — «зачем», подробные инструкции в интерфейсе больше не нужны.
 */

export function buildSpecialistHintSteps(goToTab: (tab: string) => void): HintStep[] {
    return [
        {
            target: '[data-tour="sidebar-orders"]',
            title: "Проекты",
            text: "Заказы, назначенные вам платформой: этапы, файлы, чат с заказчиком и модератором.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="sidebar-portfolio"]',
            title: "Портфолио",
            text: "Ваши проекты и работы. Их видит администратор при подборе исполнителя на заказ.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="portfolio-projects"]',
            title: "Проекты слева",
            text: "Создайте проект — это папка. Нажмите его плитку, чтобы открыть работы внутри.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="portfolio-works"]',
            title: "Работы и материалы проекта",
            text: "Плитки — отдельные работы с фото и файлами. Блок «Материалы проекта» под ними — общие файлы на всю папку.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="sidebar-landing"]',
            title: "Лендинг",
            text: "Сборка для главной страницы: портрет, обложка и портфолио. После одобрения администратором вы появляетесь на сайте.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="sidebar-payments"]',
            title: "Выплаты",
            text: "Договор, акты и выплаты по завершённым этапам.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="sidebar-settings"]',
            title: "Настройки",
            text: "Анкета, реквизиты и контакты. Держите их актуальными — по ним формируются документы.",
            before: () => goToTab("settings"),
        },
    ]
}

export function buildClientHintSteps(goToTab: (tab: string) => void): HintStep[] {
    return [
        {
            target: '[data-tour="sidebar-orders"]',
            title: "Проекты",
            text: "Здесь все ваши проекты и их этапы: концепция, планировка, визуализация, документация.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="client-orders"]',
            title: "Список проектов и бриф",
            text: "Здесь создаётся новый проект: заполните бриф — платформа подберёт дизайнера под задачу.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="client-stages"]',
            title: "Этапы и приёмка",
            text: "Каждый этап оплачивается отдельно, деньги удерживаются платформой и уходят дизайнеру только после вашей приёмки.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="sidebar-payments"]',
            title: "Оплаты и документы",
            text: "Счета, акты и договор с платформой — здесь же можно скачать закрывающие документы.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="sidebar-settings"]',
            title: "Настройки",
            text: "Контакты и реквизиты компании: по ним выставляются счета и акты.",
            before: () => goToTab("settings"),
        },
    ]
}
