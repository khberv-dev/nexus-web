#!/usr/bin/env bash
# Демо: health → POST invoice/send (контрагент ООО «Медиа 108») → GET статус счёта в T-API → при наличии pdfUrl — файл в uploads/invoices/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PDF_DIR="$ROOT/uploads/invoices"
mkdir -p "$PDF_DIR"

echo "=== 1) Health ==="
curl -sS -f "http://127.0.0.1:8090/health" | head -c 500 && echo

echo "=== 2) Выставить счёт (получатель платежа — ваш счёт из TBANK_ACCOUNT_NUMBER в .env / docker-compose) ==="
echo "    Контрагент в счёте: ООО «Медиа 108», ИНН 7728845285, КПП 526201001"

TMP_INV="$(mktemp)"
HTTP_INV="$(curl -sS -o "$TMP_INV" -w "%{http_code}" "http://127.0.0.1:8090/api/v1/invoice/send" \
  -H "Content-Type: application/json" \
  -d "$(python3 << 'PY'
import json
print(json.dumps({
    "counterparty": {
        "inn": "7728845285",
        "name": "ООО «Медиа 108»",
        "kpp": "526201001",
    },
    "items": [{"name": "Услуги (демо)", "price": 1000, "unit": "шт", "vat": "20", "amount": 1}],
    "dueDate": "2026-12-31",
    "contacts": [{"email": "billing-demo@example.com"}],
}, ensure_ascii=False))
PY
)")"

INV_JSON="$(cat "$TMP_INV")"
rm -f "$TMP_INV"

echo "HTTP статус выставления: $HTTP_INV"
if [[ "$HTTP_INV" != "200" ]]; then
  echo "Ответ сервиса:" >&2
  echo "$INV_JSON" >&2
  echo >&2
  echo "Если в логах billing-svc: RECEIVER_ACCOUNT_NOT_FOUND — задайте в .env TBANK_ACCOUNT_NUMBER (20 цифр счёта вашей организации в Т-Бизнес) и: docker compose up -d billing-svc --force-recreate" >&2
  exit 1
fi

echo "$INV_JSON" | python3 -m json.tool

TBANK_INV="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("tbankInvoiceId") or "")' "$INV_JSON")"
PDF_URL="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("pdfUrl") or "")' "$INV_JSON")"

if [[ -z "$TBANK_INV" ]]; then
  echo "Нет tbankInvoiceId в ответе" >&2
  exit 1
fi

echo "=== 3) Проверка счёта в T-API (после создания) ==="
ENV_RAW="$(docker compose exec -T billing-svc printenv TBANK_ENVIRONMENT 2>/dev/null | tr -d '\r\n' || true)"
ENV_LOWER="$(echo "${ENV_RAW:-sandbox}" | tr '[:upper:]' '[:lower:]')"
BASE_OVERRIDE="$(docker compose exec -T billing-svc printenv TBANK_BUSINESS_API_BASE_URL 2>/dev/null | tr -d '\r\n' || true)"
if [[ -n "$BASE_OVERRIDE" ]]; then
  BASE="$BASE_OVERRIDE"
elif [[ "$ENV_LOWER" == "production" || "$ENV_LOWER" == "prod" ]]; then
  BASE="https://business.tbank.ru/openapi/api/v1"
else
  BASE="https://business.tbank.ru/openapi/sandbox/api/v1"
fi
echo "    Base URL: $BASE (TBANK_ENVIRONMENT=$ENV_RAW)"

docker compose exec -T billing-svc sh -c \
  "curl -sS '${BASE}/openapi/invoice/${TBANK_INV}/info' \
    -H \"Authorization: Bearer \${TBANK_API_TOKEN}\" \
    -H 'Accept: application/json'" | python3 -m json.tool

OUT_PDF="$PDF_DIR/invoice-${TBANK_INV}.pdf"
NOTE="$PDF_DIR/invoice-${TBANK_INV}.sandbox.txt"

echo "=== 4) PDF в проект: ${OUT_PDF#$ROOT/} ==="
if [[ -z "$PDF_URL" ]]; then
  echo "В ответе нет pdfUrl — сохраняем только заметку."
  python3 -c 'import json,sys, pathlib; p=pathlib.Path(sys.argv[2]); p.write_text(
    "pdfUrl отсутствует в ответе invoice/send.\n\nJSON ответа:\n"+json.dumps(json.loads(sys.argv[1]),indent=2,ensure_ascii=False)+"\n",
    encoding="utf-8")' "$INV_JSON" "$NOTE"
  ls -la "$NOTE"
  exit 0
fi

IS_DUMMY="$(PDF_URL="$PDF_URL" python3 -c '
from urllib.parse import urlparse
import os
u = os.environ.get("PDF_URL", "")
h = (urlparse(u).hostname or "").lower()
print("1" if h.endswith("example.com") or h.endswith("example.org") else "0", end="")
')"

if [[ "$IS_DUMMY" == "1" ]]; then
  echo "Sandbox: pdfUrl ведёт на example.com — заглушка API, файла нет."
  python3 -c '
import json, sys, pathlib
inv_json, path = sys.argv[1], pathlib.Path(sys.argv[2])
data = json.loads(inv_json)
text = """Т-Банк sandbox: учебный pdfUrl (example.com), файла нет.

В продакшене pdfUrl ведёт на реальный PDF.

Ответ invoice/send:
"""
path.write_text(text + json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
' "$INV_JSON" "$NOTE"
  ls -la "$NOTE"
  exit 0
fi

set +e
curl -fsSL --max-time 30 -o "$OUT_PDF" "$PDF_URL"
CR=$?
set -e

if [[ "$CR" -ne 0 ]]; then
  echo "Скачивание pdfUrl завершилось с кодом $CR." >&2
  rm -f "$OUT_PDF"
  exit 1
fi

MAGIC="$(head -c 4 "$OUT_PDF" || true)"
if [[ "$MAGIC" != "%PDF" ]]; then
  echo "Предупреждение: содержимое не похоже на PDF." >&2
  mv -f "$OUT_PDF" "${OUT_PDF%.pdf}.download.bin"
  ls -la "${OUT_PDF%.pdf}.download.bin"
  file "${OUT_PDF%.pdf}.download.bin"
  exit 0
fi

ls -la "$OUT_PDF"
file "$OUT_PDF"
