/**
 * Устанавливает CORS-политику для S3 бакета.
 * Запуск: npx tsx scripts/setup-s3-cors.ts
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3"
import * as dotenv from "dotenv"

dotenv.config()

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

const BUCKET = process.env.S3_BUCKET!

async function main() {
  console.log(`Настройка CORS для бакета: ${BUCKET} (${process.env.S3_ENDPOINT})`)

  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }))

  console.log("✓ CORS установлен")

  // Проверяем
  const result = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }))
  console.log("Текущие правила:", JSON.stringify(result.CORSRules, null, 2))
}

main().catch(e => { console.error("Ошибка:", e.message); process.exit(1) })
