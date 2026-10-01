/**
 * RAG Service - embed teks + simpan/query Supabase pgvector.
 * Embedding pakai Xenova/transformers (lokal, gratis, no API).
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// Lazy load transformer (besar, load sekali)
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/nomic-embed-text-v1',
      { quantized: true } // model kecil, cepat
    );
  }
  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

export async function indexCourseDocument({
  courseId,
  category,
  content,
  metadata,
}: {
  courseId: string;
  category: string;
  content: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const embedding = await embedText(content);

  // Insert via raw SQL karena pgvector tidak support Prisma native
  await supabase.rpc('insert_course_document', {
    p_course_id: courseId,
    p_category: category,
    p_content: content, // ONBOARDING CONTEXT COMPANY
    p_embedding: JSON.stringify(embedding),
    p_metadata: metadata ?? {},
  });
}

export async function retrieveContext(
  query: string,
  courseId: string,
  topK: number = 4
): Promise<string> {
  try {
    const embedding = await embedText(query);

    const { data, error } = await supabase.rpc('search_course_docs', {
      query_embedding: JSON.stringify(embedding),
      p_course_id: courseId,
      match_count: topK,
    });

    if (error || !data?.length) return '';

    return data
      .map((doc: any) => `[${doc.category}]\n${doc.content}`)
      .join('\n\n');
  } catch (err) {
    // Graceful degradation: kalau onnxruntime/RAG gagal, lanjut tanpa konteks RAG
    logger.warn({ err: (err as Error).message }, '[RAG] retrieveContext gagal, skip RAG');
    return '';
  }
}

// Hapus semua dokumen course (saat manager edit/delete course)
export async function deleteCourseDocuments(courseId: string): Promise<void> {
  await supabase
    .from('course_documents')
    .delete()
    .eq('course_id', courseId);
}