/** Короткие нейтральные сообщения без пояснений процесса. */
export function explainNextAuthEmailError(code: string | null | undefined): string {
  if (code === "EmailSignin") {
    return "Не удалось отправить письмо. Попробуйте еще раз.";
  }
  if (code === "AccessDenied") return "Вход недоступен.";
  return "Что-то пошло не так. Попробуйте позже.";
}
