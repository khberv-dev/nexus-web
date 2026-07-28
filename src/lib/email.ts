import { Resend } from "resend";
import { escapeHtml, renderEmailLayout, renderJsonBlock } from "@/lib/email-template";

const FROM = process.env.EMAIL_FROM ?? "noreply@example.com";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

function getBaseAppUrl(): string {
  const primary = (process.env.NEXTAUTH_URL ?? "").trim().replace(/\/$/, "")
  if (primary) return primary
  // Vercel / preview: публичный хост без схемы в VERCEL_URL
  const vercel = (process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "")
  if (vercel) return `https://${vercel}`
  return ""
}

function toAbsoluteAppUrl(url: string | null): string | null {
  if (!url) return null
  const u = url.trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  const base = getBaseAppUrl()
  if (!base) return u
  if (u.startsWith("/")) return `${base}${u}`
  return `${base}/${u}`
}

export type EmailTrigger =
  | "new_application"
  | "onboarding_status"
  | "new_order"
  | "order_assigned"
  | "file_uploaded"
  | "stage_mod_approved"
  | "stage_revision"
  | "stage_approved"
  | "extra_payment_required"
  | "payment_received"
  | "project_done"
  | "framework_contract_ready";

const SUBJECTS: Record<EmailTrigger, string> = {
  new_application: "Новая анкета специалиста",
  onboarding_status: "Статус вашего онбординга изменен",
  new_order: "Новый заказ",
  order_assigned: "Вам назначен заказ",
  file_uploaded: "Специалист загрузил файлы",
  stage_mod_approved: "Этап прошел модерацию",
  stage_revision: "Этап возвращен на правки",
  stage_approved: "Клиент одобрил этап",
  extra_payment_required: "Требуется доплата за правки",
  payment_received: "Оплата получена",
  project_done: "Проект завершен",
  framework_contract_ready: "Договор оказания услуг готов к подписанию",
};

function renderFrameworkContractReadyEmail(data: Record<string, unknown>): string {
  const cabinetUrl = typeof data.cabinetUrl === "string" ? data.cabinetUrl : ""
  const number = typeof data.contractNumber === "string" ? data.contractNumber : ""
  const pre = "В личном кабинете доступен PDF и кнопки подписания"
  const bodyLines = [
    "Менеджер прикрепил договор оказания услуг с платформой.",
    number ? `Номер договора: ${number}.` : "",
    "Откройте раздел «Оплата» в кабинете: там можно скачать PDF, при необходимости загрузить скан с подписью и нажать «Подписан».",
  ]
    .filter(Boolean)
    .join(" ")

  return renderEmailLayout({
    preheader: pre,
    welcomeText: "Здравствуйте!",
    bodyHtml: `
    <p class="text-body" style="text-align:left">${escapeHtml(bodyLines)}</p>
    ${
      cabinetUrl
        ? `<a href="${escapeHtml(cabinetUrl)}" class="activation-link">Открыть договор в кабинете</a>
           <p class="link-copy" style="text-align:center;margin-top:8px">После входа откроется вкладка «Оплата»: там кнопки «Скачать PDF», «Загрузить подписанный скан» и «Подписан».</p>`
        : `<p class="link-copy" style="text-align:left;margin-top:16px">Войдите в личный кабинет NEXUS и откройте раздел «Оплата» — там появится договор и кнопки действий.</p>`
    }
    <div class="link-copy" style="text-align:left;margin-top:24px">
      <div>Детали:</div>
      ${renderJsonBlock(data)}
    </div>
  `,
  })
}

function renderTriggerEmail(trigger: EmailTrigger, data: Record<string, unknown>): string {
  if (trigger === "framework_contract_ready") {
    return renderFrameworkContractReadyEmail(data)
  }

  // Dedicated onboarding_status templates based on data.status
  if (trigger === "onboarding_status") {
    return renderOnboardingEmail(data)
  }

  const title = SUBJECTS[trigger]
  const url = toAbsoluteAppUrl(typeof data.paymentUrl === "string" ? data.paymentUrl : null)
  const comment = typeof data.comment === "string" && data.comment.trim() ? data.comment.trim() : null

  const bodyHtml = `
    <p class="text-body" style="text-align:left">${escapeHtml(title)}</p>
    ${comment ? `<p class="text-body" style="text-align:left">${escapeHtml(comment)}</p>` : ""}
    ${url ? `<a href="${escapeHtml(url)}" class="activation-link">Перейти →</a>` : `<p class="text-body" style="text-align:left">Подробности доступны в личном кабинете NEXUS.</p>`}
    <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
  `

  return renderEmailLayout({
    preheader: title,
    welcomeText: "Обновление в NEXUS",
    bodyHtml,
  })
}

function resolveOnboardingSubject(data: Record<string, unknown>): string {
  const s = data.status as string | undefined
  if (s === "TEST_INVITED") return "Приглашение на квалификационное тестирование NEXUS"
  if (s === "REJECTED" && data.reason) return "Результат рассмотрения Вашей кандидатуры"
  if (s === "REJECTED") return "Результат рассмотрения Вашей кандидатуры"
  if (s === "LEVEL_PASSED") {
    const level = data.level as string | undefined
    if (level === "L1") return "Вам присвоен уровень «Начинающий»"
    if (level === "L2") return "Вам присвоен уровень «Профессионал»"
    if (level === "L3") return "Вам присвоен уровень «Мастер-дизайнер»"
    if (level === "L4") return "Вам присвоен уровень «Элита»"
    return "Результат квалификационного теста NEXUS"
  }
  if (s === "LEVEL_RETRY") return "Результат квалификационного теста NEXUS"
  if (s === "INTERVIEW_INVITED") return "Приглашение на интервью NEXUS"
  if (s === "REGULATIONS") return "Изучение регламентов платформы NEXUS"
  if (s === "CONTRACT") return "Подписание договора NEXUS"
  if (s === "ACTIVE") return "Добро пожаловать на платформу NEXUS"
  return SUBJECTS.onboarding_status
}

function renderOnboardingEmail(data: Record<string, unknown>): string {
  const s = data.status as string | undefined
  const appUrl = toAbsoluteAppUrl(typeof data.paymentUrl === "string" ? data.paymentUrl : null) ?? ""

  // 2.2 — Анкета подтверждена → приглашение на тест
  if (s === "TEST_INVITED") {
    const testUrl = appUrl || "#"
    return renderEmailLayout({
      preheader: "Приглашение на квалификационное тестирование NEXUS",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за проявленный интерес к нашей компании. Мы внимательно изучили Вашу кандидатуру и высоко оценили соответствующий опыт и квалификацию.</p>
        <p class="text-body" style="text-align:left">В связи с этим рады пригласить Вас пройти квалификационный тест для оценки профессиональных навыков и возможности включения в нашу команду. Тест позволит нам лучше понять Ваш подход к проектам и убедиться в соответствии высоким стандартам нашей компании.</p>
        <a href="${escapeHtml(testUrl)}" class="activation-link">Пройти тест →</a>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.2 — Отклонение: нет образования
  if (s === "REJECTED" && data.reason === "reject_no_education") {
    return renderEmailLayout({
      preheader: "Результат рассмотрения Вашей кандидатуры",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за проявленный интерес к нашей компании. Мы тщательно изучили Вашу кандидатуру и высоко оценили Ваше желание стать частью нашей команды.</p>
        <p class="text-body" style="text-align:left">К сожалению, вынуждены сообщить, что на текущий момент мы не можем предложить Вам сотрудничество, поскольку для этого требуется профильное образование в области дизайна интерьеров. Это условие является ключевым для обеспечения высокого качества наших проектов.</p>
        <p class="text-body" style="text-align:left">Мы будем рады рассмотреть Вашу кандидатуру повторно после получения соответствующего образования и будем ждать обновлённой анкеты.</p>
        <p class="text-body" style="text-align:left">Для Вашего удобства приводим список ведущих вузов России, предлагающих программы по дизайну интерьера:</p>
        <ul class="text-body" style="text-align:left;line-height:25px;font-size:15px">
          <li><strong>Центральный ФО (Москва):</strong> МГХПА им. С.Г. Строганова</li>
          <li><strong>Северо-Западный ФО (Санкт-Петербург):</strong> СПбГХПА им. А.Л. Штиглица</li>
          <li><strong>Приволжский ФО (Нижний Новгород/Казань):</strong> ННГАСУ или КФУ</li>
          <li><strong>Уральский ФО (Екатеринбург):</strong> УрФУ им. Б.Н. Ельцина</li>
          <li><strong>Сибирский ФО (Красноярск):</strong> СФУ, Институт архитектуры и дизайна</li>
          <li><strong>Южный ФО (Краснодар):</strong> КубГУ, Факультет архитектуры и дизайна</li>
          <li><strong>Северо-Кавказский ФО:</strong> ДГТУ или КБГУ (смежные программы по дизайну)</li>
          <li><strong>Дальневосточный ФО:</strong> ИрНИТУ (связанные программы по дизайну)</li>
        </ul>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.2 — Отклонение: нет опыта
  if (s === "REJECTED" && data.reason === "reject_no_experience") {
    return renderEmailLayout({
      preheader: "Результат рассмотрения Вашей кандидатуры",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за проявленный интерес к нашей компании. Мы тщательно изучили Вашу кандидатуру и высоко оценили Ваше желание стать частью нашей команды.</p>
        <p class="text-body" style="text-align:left">К сожалению, вынуждены сообщить, что на текущий момент мы не можем предложить Вам сотрудничество, поскольку минимальный практический опыт в разработке дизайн-проектов должен составлять 8 лет. Это условие является ключевым для обеспечения высокого качества наших проектов.</p>
        <p class="text-body" style="text-align:left">Мы будем рады рассмотреть Вашу кандидатуру повторно после получения необходимого опыта.</p>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.3 — Тест: попытка не пройдена (осталось N)
  if (s === "LEVEL_RETRY") {
    const attemptsLeft = typeof data.attemptsLeft === "number" ? data.attemptsLeft : 0
    const retryUrl = appUrl || "#"
    const attemptsText = attemptsLeft === 1
      ? "У Вас осталась <strong>одна попытка</strong>."
      : `У Вас осталось <strong>${attemptsLeft} попытки</strong>.`
    return renderEmailLayout({
      preheader: "Результат квалификационного теста",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте.</p>
        <p class="text-body" style="text-align:left">К сожалению, ваши результаты не позволяют перейти на следующий уровень.</p>
        <p class="text-body" style="text-align:left">Вы можете повторно пройти тест. ${attemptsText}</p>
        <a href="${escapeHtml(retryUrl)}" class="activation-link">Повторить тест →</a>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.3 — Тест: уровень пройден
  if (s === "LEVEL_PASSED") {
    const rank = typeof data.rank === "string" ? data.rank : ""
    const level = typeof data.level === "string" ? data.level : ""
    const isL1 = level === "L1"
    const isL2 = level === "L2"
    const isL3 = level === "L3"
    const isL4 = level === "L4"
    const nextUrl = appUrl || "#"

    // L4 — Элита
    if (isL4) {
      return renderEmailLayout({
        preheader: "Вам присвоен уровень «Элита»",
        welcomeText: "Поздравляем!",
        bodyHtml: `
          <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте и за отличные результаты. Мы впечатлены качеством выполненных заданий и высоким уровнем профессионализма.</p>
          <p class="text-body" style="text-align:left">Вам присвоен уровень <strong>«Элита»</strong>.</p>
          <p class="text-body" style="text-align:left">Приглашаем Вас на персональное интервью по видеосвязи с руководителем организации. Это позволит нам лично познакомиться, обсудить Ваш опыт, подход к проектам и потенциальное сотрудничество.</p>
          <p class="text-body" style="text-align:left">Представитель нашей команды свяжется с Вами и согласует дату и время встречи.</p>
          <p class="text-body" style="text-align:left">Интервью будет состоять из нескольких блоков:</p>
          <ul class="text-body" style="text-align:left;line-height:25px;font-size:15px">
            <li>О себе</li>
            <li>Почему выбрана профессия дизайнера интерьера</li>
            <li>Самый прорывной проект в карьере</li>
            <li>Демонстрация портфолио</li>
            <li>Самый большой провал в карьере и вынесенные уроки</li>
            <li>Описание идеального клиента</li>
            <li>Чем заинтересовала наша платформа</li>
          </ul>
          ${appUrl ? `<a href="${escapeHtml(nextUrl)}" class="activation-link">Перейти к интервью →</a>` : ""}
          <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
        `,
      })
    }

    // L3 — Мастер-дизайнер
    if (isL3) {
      return renderEmailLayout({
        preheader: "Вам присвоен уровень «Мастер-дизайнер»",
        welcomeText: "Поздравляем!",
        bodyHtml: `
          <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте и за отличные результаты. Мы впечатлены качеством выполненных заданий и высоким уровнем профессионализма.</p>
          <p class="text-body" style="text-align:left">Вам присвоен уровень <strong>«Мастер-дизайнер»</strong>.</p>
          <p class="text-body" style="text-align:left">Приглашаем Вас на финальный этап квалификационного теста. В случае его прохождения Вам будет присвоен уровень «Элита».</p>
          <p class="text-body" style="text-align:left">Вне зависимости от результатов финального квалификационного теста мы пригласим Вас на персональное интервью по видеосвязи с руководителем организации. Это позволит нам лично познакомиться, обсудить Ваш опыт, подход к проектам и потенциальное сотрудничество.</p>
          <a href="${escapeHtml(nextUrl)}" class="activation-link">Пройти тест уровня 4 →</a>
          <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
        `,
      })
    }

    // L2 — Профессионал
    if (isL2) {
      return renderEmailLayout({
        preheader: "Вам присвоен уровень «Профессионал»",
        welcomeText: "Поздравляем!",
        bodyHtml: `
          <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте и за отличные результаты. Мы впечатлены качеством выполненных заданий и высоким уровнем профессионализма. Вам присвоен уровень <strong>«Профессионал»</strong>.</p>
          <p class="text-body" style="text-align:left">Приглашаем Вас пройти тесты для перехода на уровень «Мастер-дизайнер».</p>
          <a href="${escapeHtml(nextUrl)}" class="activation-link">Пройти тест уровня 3 →</a>
          <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
        `,
      })
    }

    // L1 — Начинающий (и fallback)
    void isL1
    void rank
    return renderEmailLayout({
      preheader: "Вам присвоен уровень «Начинающий»",
      welcomeText: "Поздравляем!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте и за отличные результаты. Вам присвоен уровень <strong>«Начинающий»</strong>.</p>
        <p class="text-body" style="text-align:left">Приглашаем Вас пройти тесты для перехода на уровень «Профессионал».</p>
        <a href="${escapeHtml(nextUrl)}" class="activation-link">Пройти тест уровня 2 →</a>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.3 — Все попытки исчерпаны (L1-L3 → REJECTED)
  if (s === "REJECTED" && data.level) {
    return renderEmailLayout({
      preheader: "Результат квалификационного теста",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Благодарим Вас за участие в квалификационном тесте.</p>
        <p class="text-body" style="text-align:left">К сожалению, на текущий момент результаты не позволяют начать сотрудничество, поскольку они не полностью соответствуют высоким стандартам наших проектов. Мы заинтересованы в Вашем потенциале и предлагаем пройти обучение для повышения квалификации у наших партнёров — это поможет укрепить навыки и вернуться к нам с новой силой.</p>
        <p class="text-body" style="text-align:left">Список рекомендуемых программ и контактов партнёров направим Вам отдельным письмом в ближайшее время. Будем рады рассмотреть Вашу обновлённую кандидатуру после обучения.</p>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // 2.3 — L4 исчерпан → интервью
  if (s === "INTERVIEW_INVITED") {
    const interviewUrl = appUrl || "#"
    return renderEmailLayout({
      preheader: "Приглашение на интервью NEXUS",
      welcomeText: "Здравствуйте!",
      bodyHtml: `
        <p class="text-body" style="text-align:left">Вы не достигли проходного балла. У Вас ещё будет возможность пройти тест для присвоения уровня «Элита».</p>
        <p class="text-body" style="text-align:left">Приглашаем Вас на персональное интервью по видеосвязи с руководителем организации. Это позволит нам лично познакомиться, обсудить Ваш опыт, подход к проектам и потенциальное сотрудничество.</p>
        <p class="text-body" style="text-align:left">Представитель нашей команды свяжется с Вами и согласует дату и время встречи.</p>
        <p class="text-body" style="text-align:left">Интервью будет состоять из нескольких блоков:</p>
        <ul class="text-body" style="text-align:left;line-height:25px;font-size:15px">
          <li>О себе</li>
          <li>Почему выбрана профессия дизайнера интерьера</li>
          <li>Самый прорывной проект в карьере</li>
          <li>Демонстрация портфолио</li>
          <li>Самый большой провал в карьере и вынесенные уроки</li>
          <li>Описание идеального клиента</li>
          <li>Чем заинтересовала наша платформа</li>
        </ul>
        <a href="${escapeHtml(interviewUrl)}" class="activation-link">Перейти к интервью →</a>
        <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
      `,
    })
  }

  // Fallback: REGULATIONS, CONTRACT, ACTIVE и прочие статусы
  const cabinetUrl = appUrl || `${getBaseAppUrl()}/onboarding`
  const statusMeta: Record<string, { welcome: string; text: string; btnLabel: string; btnUrl: string }> = {
    REGULATIONS: {
      welcome: "Обновление в NEXUS",
      text: "Вам открыт доступ к изучению регламентов платформы. Ознакомьтесь с правилами работы и подтвердите готовность.",
      btnLabel: "Перейти к регламентам →",
      btnUrl: `${getBaseAppUrl()}/onboarding/regulations`,
    },
    CONTRACT: {
      welcome: "Обновление в NEXUS",
      text: "Этап подписания договора. Скачайте договор в личном кабинете, подпишите и загрузите скан.",
      btnLabel: "Перейти к договору →",
      btnUrl: `${getBaseAppUrl()}/onboarding/contract`,
    },
    ACTIVE: {
      welcome: "Добро пожаловать!",
      text: "Ваш онбординг завершён. Добро пожаловать на платформу NEXUS! Вы можете приступать к работе с заказами.",
      btnLabel: "Перейти в личный кабинет →",
      btnUrl: `${getBaseAppUrl()}/work`,
    },
  }
  const meta = statusMeta[s ?? ""]
  const bodyText = meta?.text ?? (typeof data.comment === "string" && data.comment ? data.comment : "Статус вашего онбординга изменён.")
  const btnLabel = meta?.btnLabel ?? "Перейти в кабинет →"
  const btnUrl = meta?.btnUrl ?? cabinetUrl
  return renderEmailLayout({
    preheader: "Обновление статуса онбординга",
    welcomeText: meta?.welcome ?? "Обновление в NEXUS",
    bodyHtml: `
      <p class="text-body" style="text-align:left">${escapeHtml(bodyText)}</p>
      <a href="${escapeHtml(btnUrl)}" class="activation-link">${escapeHtml(btnLabel)}</a>
      <p class="link-copy">С наилучшими пожеланиями,<br/>Команда NEXUS</p>
    `,
  })
}

export async function sendEmail(trigger: EmailTrigger, to: string, data: Record<string, unknown>): Promise<void> {
  try {
    const subject = trigger === "onboarding_status" ? resolveOnboardingSubject(data) : SUBJECTS[trigger]
    await getResend().emails.send({
      from: FROM,
      to,
      subject,
      html: renderTriggerEmail(trigger, data),
    });
  } catch (err) {
    console.error(`[email] Failed to send ${trigger} to ${to}:`, err);
  }
}
