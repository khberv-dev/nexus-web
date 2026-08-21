import type {HintStep} from "@/components/app/HintTour"

/**
 * Экскурсия по кабинету при первом входе: фокус переходит от раздела к разделу и
 * внутри каждого — по его основным блокам. Текст держим коротким: подсветка отвечает
 * на «где», текст — на «зачем», подробные инструкции в интерфейсе не нужны.
 *
 * Шаг с отсутствующей целью HintTour пропускает сам, поэтому пустые вкладки
 * (нет заказов, нет выплат) не ломают маршрут.
 */

export function buildSpecialistHintSteps(goToTab: (tab: string) => void): HintStep[] {
    return [
        // ── Знакомство ──────────────────────────────────────────────────────
        {
            target: '[data-tour="hero-profile"]',
            title: "Ваш профиль",
            text: "Фото, имя и подтверждённый уровень квалификации. По уровню и рейтингу платформа подбирает вас на заказы.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="header-bell"]',
            title: "Уведомления",
            text: "Сюда приходят новые заказы, правки от заказчика и решения модератора. Дублируются письмом.",
        },

        // ── Проекты ─────────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-orders"]',
            title: "Раздел «Проекты»",
            text: "Заказы, назначенные вам платформой. С них начинается работа.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="orders-list"]',
            title: "Список заказов",
            text: "Каждый заказ идёт по этапам: концепция → планировка → визуализация → документация → спецификация.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="orders-actions"]',
            title: "Что требует вашего действия",
            text: "Срочное и акты к подписанию. Оплата за этап приходит после того, как заказчик его принял.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="btn-sign-act"]',
            title: "Кнопка «Подписать»",
            text: "Подписывает акт по завершённому этапу — без подписи выплата не уходит.",
            before: () => goToTab("orders"),
        },

        // ── Портфолио ───────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-portfolio"]',
            title: "Раздел «Портфолио»",
            text: "Ваши работы. Их смотрит администратор, когда подбирает исполнителя на заказ.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="portfolio-projects"]',
            title: "Проекты — это папки",
            text: "Создайте проект слева и откройте его плитку, чтобы добавить внутрь работы.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="btn-add-project"]',
            title: "Кнопка «Добавить проект»",
            text: "Введите название папки и нажмите её — проект появится в сетке справа.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="btn-new-work"]',
            title: "Плитка «Новая работа»",
            text: "Открывает окно работы: название, главное фото и файлы, относящиеся только к ней.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="project-materials"]',
            title: "Материалы проекта",
            text: "Общие файлы на всю папку: PDF, спецификации, чертежи — не привязаны к одной работе.",
            before: () => goToTab("portfolio"),
        },
        {
            target: '[data-tour="portfolio-works"]',
            title: "Работы и материалы",
            text: "Плитки — отдельные работы с фото и файлами. Блок «Материалы проекта» под ними — общие файлы на всю папку.",
            before: () => goToTab("portfolio"),
        },

        // ── Лендинг ─────────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-landing"]',
            title: "Раздел «Лендинг»",
            text: "Ваша карточка на главной странице платформы — витрина для заказчиков.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="landing-readiness"]',
            title: "Готовность карточки",
            text: "Чек-лист: портрет, фото интерьера, видео-визитка, работы, специализация и текст о себе.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="landing-uploader"]',
            title: "Сборка карточки",
            text: "Каждый блок — свой материал: портрет, интерьер, видео и работы для галереи.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="btn-landing-portrait"]',
            title: "Загрузить портрет",
            text: "Вертикальное фото — им карточка показывается в карусели на главной.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="btn-landing-work"]',
            title: "Загрузить фото интерьера",
            text: "Горизонтальный кадр работы — он раскрывается, когда карточку открывают.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="btn-landing-video"]',
            title: "Видео-визитка",
            text: "Необязательно, но заметно повышает доверие: короткий вертикальный ролик о себе.",
            before: () => goToTab("landing"),
        },
        {
            target: '[data-tour="btn-landing-submit"]',
            title: "Кнопка «Отправить на модерацию»",
            text: "Становится активной, когда выбраны портрет и интерьер. После одобрения вы появляетесь на главной.",
            before: () => goToTab("landing"),
        },

        // ── Выплаты ─────────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-payments"]',
            title: "Раздел «Выплаты»",
            text: "Деньги и документы по завершённым этапам.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="payments-summary"]',
            title: "Договор, акты и реквизиты",
            text: "Здесь договор с платформой и акты по этапам. Выплаты уходят на реквизиты из настроек.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="btn-contract-download"]',
            title: "Кнопка «Скачать»",
            text: "Скачивает PDF договора, который подготовил администратор.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="btn-contract-sign"]',
            title: "Кнопка «Подписан»",
            text: "Загрузите скан с подписью и подтвердите — администратор проверит и закроет этап.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="payments-history"]',
            title: "История выплат",
            text: "Что и когда перечислено. Платформа удерживает оплату этапа до приёмки заказчиком.",
            before: () => goToTab("payments"),
        },

        // ── Настройки ───────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-settings"]',
            title: "Раздел «Настройки»",
            text: "Анкета, контакты и реквизиты — по ним формируются документы и выплаты.",
            before: () => goToTab("settings"),
        },
        {
            target: '[data-tour="settings-form"]',
            title: "Анкета и реквизиты",
            text: "Держите актуальными: специализацию, стили и банковские данные.",
            before: () => goToTab("settings"),
        },
        {
            target: '[data-tour="btn-save-profile"]',
            title: "Кнопка «Сохранить»",
            text: "Сохраняет анкету. Изменение банковских реквизитов дополнительно проверяет администратор.",
            before: () => goToTab("settings"),
        },

        // ── Как вернуть подсказки ───────────────────────────────────────────
        {
            target: '[data-tour="sidebar-logout"]',
            title: "Кнопка выхода",
            text: "Выйти из кабинета можно внизу боковой панели.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="btn-hints"]',
            title: "Кнопка «?»",
            text: "Открывает эти подсказки заново в любой момент.",
        },
    ]
}

export function buildClientHintSteps(goToTab: (tab: string) => void): HintStep[] {
    return [
        // ── Знакомство ──────────────────────────────────────────────────────
        {
            target: '[data-tour="client-hero"]',
            title: "Ваш кабинет",
            text: "Здесь видно, сколько проектов в работе и что ждёт вашего решения.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="header-bell"]',
            title: "Уведомления",
            text: "Этапы на приёмку, сообщения дизайнера и счета. Дублируются письмом.",
        },

        // ── Проекты ─────────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-orders"]',
            title: "Раздел «Проекты»",
            text: "Все ваши проекты и их этапы.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="client-orders"]',
            title: "Список проектов",
            text: "Все ваши заказы и их текущий статус.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="btn-create-order"]',
            title: "Кнопка «Создать проект»",
            text: "Открывает бриф: опишите объект и задачу — платформа подберёт дизайнера.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="client-stages"]',
            title: "Этапы и приёмка",
            text: "Этап оплачивается отдельно, деньги держит платформа и передаёт дизайнеру только после вашей приёмки.",
            before: () => goToTab("orders"),
        },

        // ── Оплаты ──────────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-payments"]',
            title: "Раздел «Оплаты»",
            text: "Счета, акты и договор с платформой.",
            before: () => goToTab("payments"),
        },
        {
            target: '[data-tour="client-payments"]',
            title: "Документы по проекту",
            text: "Здесь оплачиваются этапы и скачиваются закрывающие документы.",
            before: () => goToTab("payments"),
        },

        // ── Настройки ───────────────────────────────────────────────────────
        {
            target: '[data-tour="sidebar-settings"]',
            title: "Раздел «Настройки»",
            text: "Контакты и реквизиты компании — по ним выставляются счета и акты.",
            before: () => goToTab("settings"),
        },
        {
            target: '[data-tour="client-settings"]',
            title: "Реквизиты",
            text: "Заполните данные компании заранее — без них не выставить счёт на первый этап.",
            before: () => goToTab("settings"),
        },
        {
            target: '[data-tour="btn-save-requisites"]',
            title: "Кнопка «Сохранить изменения»",
            text: "Сохраняет контакты и реквизиты, по которым выставляются счета и акты.",
            before: () => goToTab("settings"),
        },

        // ── Как вернуть подсказки ───────────────────────────────────────────
        {
            target: '[data-tour="sidebar-logout"]',
            title: "Кнопка выхода",
            text: "Выйти из кабинета можно внизу боковой панели.",
            before: () => goToTab("orders"),
        },
        {
            target: '[data-tour="btn-hints"]',
            title: "Кнопка «?»",
            text: "Открывает эти подсказки заново в любой момент.",
        },
    ]
}
