/**
 * OpenAI LLM Client - pengganti cerebrasClient.
 * Semua service sekarang menggunakan OpenAI GPT sebagai LLM provider.
 * Support: retry 429, multi API key rotation, JSON parsing, usage logging.
 */
import { OpenAI } from 'openai';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';

export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

let cachedApiKey: string | null = null;
let cachedApiKeyExpiresAt: number = 0;

/**
 * Ambil API key aktif dari database (rotasi), fallback ke env.
 * Dengan in-memory caching 5 menit.
 */
export async function getActiveApiKey(provider: string): Promise<string> {
  const now = Date.now();
  if (provider === 'openai' && cachedApiKey && now < cachedApiKeyExpiresAt) {
    return cachedApiKey;
  }

  try {
    const activeKey = await prisma.aiApiKey.findFirst({
      where: { provider, isActive: true },
      orderBy: { lastUsedAt: 'asc' },
    });

    if (activeKey) {
      // Update lastUsedAt fire-and-forget
      prisma.aiApiKey.update({
        where: { id: activeKey.id },
        data: { lastUsedAt: new Date() }
      }).catch((err: unknown) => logger.error({ err }, "Failed to update lastUsedAt"));

      const key = decrypt(activeKey.keyHash);
      if (provider === 'openai') {
        cachedApiKey = key;
        cachedApiKeyExpiresAt = now + 5 * 60 * 1000; // 5 menit
      }
      return key;
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to get API key from database");
  }

  return process.env.OPENAI_API_KEY || '';
}

/**
 * Panggil OpenAI Chat Completion, return teks.
 * Sudah termasuk retry untuk 429 rate limit.
 */
export async function callGPT(
  messages: LLMMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    sessionId?: string;
    userId?: string;
    service?: string;
  } = {}
): Promise<string> {
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const apiKey = await getActiveApiKey('openai');
  const openai = new OpenAI({ apiKey });

  const startTime = Date.now();
  let completion: any;
  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      completion = await openai.chat.completions.create({
        model,
        messages,
        max_completion_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.3,
        stream: false,
      });
      break; // Success, exit loop
    } catch (error: unknown) {
      attempt++;
      if (typeof error === "object" && error !== null && "status" in error && error.status === 429 && attempt < maxRetries) {
        logger.warn({ attempt, maxRetries }, '[OpenAI] 429 Too Many Requests. Retrying...');
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else {
        throw error;
      }
    }
  }
  const latencyMs = Date.now() - startTime;

  const choices = completion.choices as any[];
  const text = choices[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI: empty response');

  // Fire and forget logging
  if (completion.usage) {
    const usage = completion.usage as any;
    prisma.aiUsageLog.create({
      data: {
        sessionId: options.sessionId || null,
        userId: options.userId || null,
        service: options.service || 'general',
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        latencyMs,
      },
    }).catch((err: unknown) => logger.error({ err }, 'Failed to log OpenAI usage'));
  }

  return text;
}

/**
 * Panggil OpenAI Chat Completion, parse response sebagai JSON.
 * Otomatis bersihkan markdown code block jika ada.
 */
export async function callGPTJson<T>(
  messages: LLMMessage[],
  options: {
    model?: string;
    temperature?: number;
    sessionId?: string;
    userId?: string;
    service?: string;
    maxTokens?: number;
    schema?: z.ZodType<T>;
  } = {}
): Promise<T> {
  const { schema, ...requestOptions } = options;
  const raw = await callGPT(messages, {
    ...requestOptions,
    maxTokens: options.maxTokens ?? 3000,
  });

  // Bersihkan markdown code block kalau ada
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed: unknown = JSON.parse(clean);
    return schema ? schema.parse(parsed) : parsed as T;
  } catch {
    throw new Error(`OpenAI JSON parse error. Raw: ${raw.slice(0, 200)}`);
  }
}

/**
 * Panggil OpenAI Chat Completion dan kembalikan secara streaming (chunks).
 */
export async function* streamGPT(
  messages: LLMMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    sessionId?: string;
    userId?: string;
    service?: string;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const apiKey = await getActiveApiKey('openai');
  const openai = new OpenAI({ apiKey });

  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      const stream = await openai.chat.completions.create({
        model,
        messages,
        max_completion_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.3,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
      break; // Success, exit loop
    } catch (error: unknown) {
      attempt++;
      if (typeof error === "object" && error !== null && "status" in error && error.status === 429 && attempt < maxRetries) {
        logger.warn({ attempt, maxRetries }, '[OpenAI] 429 Too Many Requests. Retrying stream...');
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else {
        throw error;
      }
    }
  }
}
