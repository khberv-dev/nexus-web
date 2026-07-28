import { ACT_STATUS_LABEL, type StageAct } from "../types"

export function actWaitingMessage(act: StageAct): string {
  if (act.status === "REJECTED") {
    return "Акт на доработке у дизайнера. После повторной загрузки и проверки администратором вы сможете скачать документ и отправить подписанную версию."
  }
  if (act.status === "PENDING") {
    return "Дизайнер ещё не загрузил акт выполненных работ. Когда файл будет готов, он пройдёт проверку администратором — затем здесь появится ссылка и загрузка подписанного PDF."
  }
  if (act.status === "SPECIALIST_UPLOADED") {
    return "Акт загружен дизайнером и проверяется администратором. После проверки вы сможете скачать документ и загрузить подписанный PDF."
  }
  return `Статус акта: ${ACT_STATUS_LABEL[act.status] ?? act.status}. Подписание доступно только после проверки администратором.`
}

