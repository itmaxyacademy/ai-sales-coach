/**
 * Session State Service.
 * Hitung perubahan trust, mood, stage per turn.
 * Pure function - tidak ada side effect.
 */
import type { SessionState } from './roleplayService.js';

type StateUpdate = {
  trustDelta: number;
  newTrust: number;
  newMood: string;
  newStage: string;
  newObjCount: number;
};

export function calculateStateUpdate(
  current: SessionState,
  customerResponse: string
): StateUpdate {
  // Deteksi sinyal dari respons customer
  const response = customerResponse.toLowerCase();

  // Trust delta berdasarkan sinyal
  let trustDelta = 0;

  // Sinyal positif (Bahasa Indonesia & English)
  if (/tertarik|penasaran|mau tahu|boleh cerita|bagaimana caranya|interested|curious|tell me more|sounds good|makes sense/.test(response)) trustDelta += 0.4;
  if (/oke|setuju|masuk akal|bisa dicoba|make sense|agree|deal|let's do|fair enough/.test(response)) trustDelta += 0.6;
  if (/kapan|jadwal|demo|coba|test|schedule|trial|meeting|visit/.test(response)) trustDelta += 0.8;

  // Sinyal negatif & penolakan out-of-context (Bahasa Indonesia & English)
  if (/mahal|kemahalan|terlalu|tidak perlu|gak perlu|expensive|overpriced|don't need|too much/.test(response)) trustDelta -= 0.5;
  if (/pikir.pikir|nanti|tidak yakin|ragu|not sure|hesitant|maybe later|doubt/.test(response)) trustDelta -= 0.3;
  if (/tidak mau|tidak tertarik|tidak cocok|gak cocok|not interested|unacceptable|reject/.test(response)) trustDelta -= 0.8;
  if (/jaga ucapan|buang.buang waktu|ngomong apa|aneh.aneh|salah sambung|fokus|ngelantur|respek|waste.*time|watch your mouth|what are you talking|respect|out of line/.test(response)) trustDelta -= 0.7;

  // Hitung trust baru
  const newTrust = Math.max(1.0, Math.min(5.0, current.trustLevel + trustDelta));

  // Tentukan mood baru
  const newMood = newTrust >= 4.0 ? 'excited'
    : newTrust >= 3.5 ? 'interested'
    : newTrust >= 3.0 ? 'curious'
    : newTrust >= 2.0 ? 'neutral'
    : 'skeptical';

  // Tentukan stage baru
  const newStage = newTrust >= 4.5 ? 'decided'
    : newTrust >= 4.0 ? 'negotiating'
    : newTrust >= 3.0 ? 'interested'
    : newTrust >= 2.0 ? 'warming'
    : 'cold';

  // Hitung objection count (Bahasa Indonesia & English)
  const hasObjection = /mahal|terlalu|tidak perlu|gak perlu|ragu|tidak yakin|expensive|overpriced|don't need|too much|hesitant|doubt/.test(response);
  const newObjCount = hasObjection
    ? current.objectionCount + 1
    : current.objectionCount;

  return {
    trustDelta,
    newTrust,
    newMood,
    newStage,
    newObjCount,
  };
}
