import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string(),
  JWT_SECRET: z.string(),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_ORIGINS: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Scraper microservice
  SCRAPER_PYTHON_URL: z.string().default('http://127.0.0.1:8001'),

  // TTS microservice
  TTS_PYTHON_URL: z.string().default('http://127.0.0.1:5001'),

  // Supabase (untuk pgvector raw queries)
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;