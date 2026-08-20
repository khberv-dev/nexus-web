import EmailProvider from "next-auth/providers/email";
import {Resend} from "resend";
import {prisma} from "@/lib/db/prisma";
import {escapeHtml, renderEmailLayout} from "@/lib/email-template";
import {getResendApiKey, resolveResendFrom} from "@/lib/email-config";

/**
 * Отправка магической ссылки. Конфигурация «From» и признак рабочего ключа —
 * общие с триггерными письмами, см. src/lib/email-config.ts.
 *
 * Ограничение Resend: без верифицированного домена API часто принимает только адресата =
 * email владельца аккаунта Resend; иначе ошибка «testing emails to your own email».
 *
 * Ссылка из письма не уходит «в пустоту»: только если в БД уже есть User с этим email
 * или активная заявка PendingSignup (после кнопки «Регистрация»).
 */

export function resendEmailProvider() {
    return EmailProvider({
        from: resolveResendFrom(),
        maxAge: 24 * 60 * 60,
        sendVerificationRequest: async ({identifier: email, url}) => {
            const emailNorm = email.trim().toLowerCase();
            const [existingUser, pendingSignup] = await Promise.all([
                prisma.user.findUnique({where: {email: emailNorm}, select: {id: true}}),
                prisma.pendingSignup.findUnique({where: {email: emailNorm}, select: {email: true}}),
            ]);
            if (!existingUser && !pendingSignup) {
                throw new Error(
                    "Такого аккаунта еще нет. Сначала пройдите «Регистрацию» на странице входа — после сохранения анкеты можно запросить письмо со ссылкой."
                );
            }

            const key = getResendApiKey();
            const devLog =
                process.env.NODE_ENV === "development" || process.env.AUTH_EMAIL_DEV_LOG === "1";

            if (!key) {
                if (devLog) {
                    console.warn(
                        "\n[auth/email] RESEND_API_KEY не настроен — письмо не отправляется. Ссылка для входа (скопируйте в браузер):\n\n" +
                        url +
                        "\n\nПолучить ключ: https://resend.com/api-keys → добавьте RESEND_API_KEY в .env\n"
                    );
                    return;
                }
                throw new Error(
                    "RESEND_API_KEY не задан или оставлен плейсхолдер. Укажите ключ в .env (Resend → API Keys) или для отладки задайте AUTH_EMAIL_DEV_LOG=1."
                );
            }

            const from = resolveResendFrom();
            const resend = new Resend(key);
            const html = renderEmailLayout({
                preheader: "Ссылка для входа в NEXUS",
                welcomeText: "Добро пожаловать в NEXUS",
                bodyHtml: `
          <p class="text-body">
            Для входа в личный кабинет нажмите на кнопку ниже.
            <br />
            Ссылка действует ограниченное время.
          </p>
          <a href="${escapeHtml(url)}" class="activation-link">Войти</a>
          <div class="link-copy">
            <div>Или скопируйте ссылку и вставьте в браузер:</div>
            <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
          </div>
        `,
            });
            const logLinkOnFailure = (reason: string) => {
                if (devLog) {
                    console.warn(
                        "\n[auth/email] Не удалось отправить письмо (" +
                        reason +
                        ") — ссылка для входа (скопируйте в браузер):\n\n" +
                        url +
                        "\n"
                    );
                }
            };

            let sendResult: Awaited<ReturnType<typeof resend.emails.send>>;
            try {
                sendResult = await resend.emails.send({
                    from,
                    to: email,
                    subject: "Вход в NEXUS",
                    html,
                });
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                logLinkOnFailure(reason);
                throw err instanceof Error ? err : new Error(reason);
            }

            if (sendResult.error) {
                logLinkOnFailure(sendResult.error.message);
                throw new Error(sendResult.error.message);
            }
        },
    });
}
