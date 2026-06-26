// apps/api/src/config/env.ts
// Validação de variáveis de ambiente via Zod
// O servidor não sobe se alguma variável obrigatória estiver faltando

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter no mínimo 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('hidrobr_minio'),
  S3_SECRET_KEY: z.string().default('hidrobr_minio_2025'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET_EVIDENCES: z.string().default('hidrobr-evidences'),
  S3_BUCKET_ACADEMY: z.string().default('hidrobr-academy'),
  S3_BUCKET_REPORTS: z.string().default('hidrobr-reports'),
  S3_BUCKET_AVATARS: z.string().default('hidrobr-avatars'),

  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('HIDROBR GISTM <noreply@hidrobr.com.br>'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  result.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`)
  })
  process.exit(1)
}

export const env = result.data
