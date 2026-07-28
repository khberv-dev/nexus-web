type EmailLayoutOptions = {
  preheader?: string
  welcomeText?: string
  bodyHtml: string
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function renderEmailLayout({ preheader, welcomeText, bodyHtml }: EmailLayoutOptions): string {
  const pre = preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : ""
  const welcome = welcomeText
    ? `<div class="text-welcome">${escapeHtml(welcomeText)}</div>`
    : ""

  return `
<!doctype html>
<html lang="ru">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background-color: #eee; font-family: Arial, Helvetica, sans-serif; color: #1f1831; }
    .wrapper { background-color: #fff; border-radius: 4px; max-width: 550px; width: 100%; margin: 60px 0; padding: 30px 50px; box-sizing: border-box; }
    .wrapper-td { padding: 0 10px; }
    .logo-wrap { text-align: center; padding: 16px 0; margin-bottom: 52px; font-size: 32px; font-weight: 800; letter-spacing: 0.06em; color: #1b1230; }
    .text-wrap { text-align: center; margin: 20px 0; }
    .text-welcome { font-weight: bold; font-size: 18px; margin-bottom: 24px; }
    .text-body { line-height: 25px; font-size: 15px; }
    .activation-link { display: inline-block; padding: 16px 50px; border-radius: 50px; background-color: #877BED; text-transform: uppercase; color: #fff !important; text-decoration: none; margin: 36px 0 42px; font-weight: 700; letter-spacing: 0.03em; }
    .link-copy { opacity: .75; font-size: 14px; line-height: 24px; }
    .link-copy a { color: #4b3dc5; word-break: break-all; }
  </style>
</head>
<body>
  ${pre}
  <table width="100%" style="background-color:#eee" border="0" cellspacing="0" cellpadding="0" role="presentation">
    <tr>
      <td align="center" class="wrapper-td">
        <div class="wrapper">
          <div class="logo-wrap">NEXUS</div>
          <div class="text-wrap">
            ${welcome}
            ${bodyHtml}
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

export function renderJsonBlock(data: Record<string, unknown>): string {
  const pretty = escapeHtml(JSON.stringify(data, null, 2))
  return `<pre style="text-align:left;background:#f7f6fc;border:1px solid #ece9fb;border-radius:8px;padding:12px;font-size:12px;line-height:18px;overflow:auto;">${pretty}</pre>`
}
