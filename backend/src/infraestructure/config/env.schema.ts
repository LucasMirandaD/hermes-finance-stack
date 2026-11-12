import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_SYNCHRONIZE: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  DB_LOGGING: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  PAPERLESS_BASE_URL: z.string().url().default('http://paperless:8000'),
  PAPERLESS_API_TOKEN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = JSON.stringify(parsed.error.format(), null, 2);
    throw new Error(`[EnvValidationError] Config validation error:\n${errorDetails}`);
  }
  return parsed.data;
}
