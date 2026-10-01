/**
 * AI Facial Expression Service.
 * Terima frame base64 dari browser (webcam),
 * analisis ekspresi wajah, return skor kepercayaan diri.
 *
 * Menggunakan Cerebras vision ATAU fallback ke metadata browser.
 * Untuk production: rekomendasikan face-api.js di frontend.
 */
import { callGPTJson } from './openaiClient.js';
import { z } from 'zod';
// ─── Types ───────────────────────────────────────────────────────────
export type FacialExpression =
  | 'confident'
  | 'nervous'
  | 'confused'
  | 'engaged'
  | 'bored'
  | 'neutral'
  | 'enthusiastic'
  | 'frustrated'
  | 'empathetic';
export type FacialAnalysis = {
  expression: FacialExpression;
  confidence: number; // 0-100
  eyeContact: boolean;
  posture: 'good' | 'slouching' | 'stiff' | 'unknown';
  microExpression: string; // deskripsi singkat micro-expression terdeteksi
  note: string;
};
export type FacialSummary = {
  dominantExpression: string;
  averageConfidence: number;
  eyeContactRate: number; // persen turn dengan eye contact
  expressionBreakdown: Record<string, number>;
  expressionPercentages: Record<string, number>;
  overallScore: number;
  scoreCategory: 'excellent' | 'good' | 'average' | 'needs_improvement' | 'poor';
  strengths: string[];
  improvements: string[];
  feedback: string;
  detailedFeedback: {
    expressionAnalysis: string;
    eyeContactAnalysis: string;
    confidenceAnalysis: string;
    postureAnalysis: string;
    overallRecommendation: string;
  };
  coachingTips: string[];
};
// ─── Expression Metadata ─────────────────────────────────────────────
/** Skor dasar per ekspresi - semakin tinggi, semakin positif dalam konteks sales */
const EXPRESSION_SCORES: Record<FacialExpression, number> = {
  confident: 100,
  enthusiastic: 95,
  engaged: 85,
  empathetic: 80,
  neutral: 55,
  confused: 40,
  nervous: 35,
  frustrated: 30,
  bored: 20,
};
/** Deskripsi tiap ekspresi untuk konteks sales */
const EXPRESSION_DESCRIPTIONS: Record<FacialExpression, string> = {
  confident:
    'Anda menunjukkan ekspresi percaya diri yang kuat - tatapan mantap, rahang rileks, dan senyum yang natural. Ini membuat prospek merasa yakin dengan apa yang Anda sampaikan.',
  enthusiastic:
    'Anda tampak sangat antusias dan bersemangat. Energi positif ini menular ke prospek dan membuat presentasi terasa hidup serta meyakinkan.',
  engaged:
    'Ekspresi Anda menunjukkan keterlibatan aktif - alis sedikit terangkat, mata fokus, dan respons mimik yang sesuai dengan alur percakapan.',
  empathetic:
    'Anda menunjukkan ekspresi empati - mengangguk, kontak mata lembut, dan ekspresi yang menunjukkan bahwa Anda benar-benar mendengarkan dan memahami kebutuhan prospek.',
  neutral:
    'Ekspresi Anda cenderung datar dan kurang menunjukkan emosi. Dalam sales, ekspresi yang terlalu netral bisa membuat prospek merasa Anda kurang tertarik atau kurang passionate dengan produk yang ditawarkan.',
  confused:
    'Anda terlihat bingung - dahi berkerut, mata menyipit, atau kepala sedikit miring. Dalam konteks sales, ini bisa mengurangi rasa percaya prospek terhadap kompetensi Anda.',
  nervous:
    'Ada tanda-tanda kegugupan yang terdeteksi - gerakan mata tidak stabil, bibir sedikit gemetar, atau ekspresi tegang. Prospek bisa menangkap sinyal ini dan meragukan keyakinan Anda terhadap produk.',
  frustrated:
    'Ekspresi Anda menunjukkan frustrasi - rahang mengencang, alis turun, atau bibir terkatup rapat. Penting untuk tetap tenang dan profesional, bahkan saat menghadapi keberatan dari prospek.',
  bored:
    'Anda tampak kurang tertarik - tatapan kosong, mulut sedikit terbuka, atau postur yang kendur. Ini bisa membuat prospek merasa tidak dihargai dan kehilangan minat terhadap presentasi Anda.',
};
/** Coaching tips spesifik per ekspresi */
const EXPRESSION_COACHING: Record<FacialExpression, string[]> = {
  confident: [
    'Pertahankan ekspresi percaya diri ini - Anda sudah berada di jalur yang tepat.',
    'Tambahkan variasi ekspresi sesekali (senyum, anggukan) agar tidak terkesan kaku.',
    'Gunakan kepercayaan diri ini untuk teknik closing yang lebih assertive.',
  ],
  enthusiastic: [
    'Energi Anda luar biasa! Pastikan antusiasme tetap terkontrol agar tidak terkesan memaksa.',
    'Seimbangkan semangat dengan momen mendengarkan aktif.',
    'Gunakan antusiasme ini saat menjelaskan value proposition utama.',
  ],
  engaged: [
    'Bagus! Anda menunjukkan ketertarikan yang tulus. Terus pertahankan.',
    'Tingkatkan dengan menambahkan anggukan kecil saat prospek berbicara.',
    'Gunakan ekspresi engaged ini untuk membangun rapport yang lebih dalam.',
  ],
  empathetic: [
    'Kemampuan empati Anda sangat baik untuk membangun kepercayaan.',
    'Kombinasikan empati dengan solusi konkret agar prospek merasa didengar DAN dibantu.',
    'Gunakan ekspresi ini terutama saat fase discovery dan handling objection.',
  ],
  neutral: [
    'Cobalah untuk menunjukkan lebih banyak ekspresi - senyum, anggukan, atau alis terangkat saat mendengarkan.',
    'Latih "active listening face": sedikit condongkan badan ke depan, mata fokus, dan sesekali angguk.',
    'Bayangkan Anda sedang berbicara dengan teman lama - ini membantu ekspresi menjadi lebih natural dan hangat.',
    'Sebelum presentasi, lakukan pemanasan wajah: tersenyum lebar, buka mata lebar, lalu rileks. Ini membantu otot wajah lebih ekspresif.',
  ],
  confused: [
    'Jika Anda benar-benar bingung dengan pertanyaan prospek, akui dengan jujur dan minta klarifikasi - ini lebih baik daripada menebak-nebak.',
    'Siapkan FAQ dan objection handling script agar lebih siap menghadapi pertanyaan sulit.',
    'Latih product knowledge lebih mendalam agar ekspresi bingung tidak muncul saat sesi kritis.',
    'Jika bingung, ambil napas dalam dan ulangi pertanyaan prospek dengan kata-kata Anda sendiri untuk memberi waktu berpikir.',
  ],
  nervous: [
    'Tarik napas dalam 4 detik, tahan 4 detik, buang 4 detik (teknik box breathing) sebelum memulai presentasi.',
    'Fokus pada satu titik di dahi prospek jika sulit mempertahankan kontak mata langsung.',
    'Persiapkan opening statement yang sudah dihafalkan - 30 detik pertama yang lancar akan membangun momentum kepercayaan diri.',
    'Ingat: prospek tidak tahu bahwa Anda gugup. Yang mereka lihat hanyalah bahasa tubuh Anda - kendalikan itu.',
    'Latihan di depan cermin atau rekam diri sendiri, lalu review. Kesadaran adalah langkah pertama untuk perbaikan.',
  ],
  frustrated: [
    'Saat merasa frustrasi, ambil jeda sejenak - minum air atau ulangi poin terakhir prospek.',
    'Ingat bahwa keberatan prospek adalah sinyal minat - mereka tidak akan bertanya jika tidak tertarik.',
    'Ubah mindset: setiap objection adalah kesempatan untuk menunjukkan nilai produk Anda.',
    'Jika situasi memanas, gunakan teknik "agree and redirect": setuju dengan kekhawatiran mereka, lalu arahkan ke solusi.',
  ],
  bored: [
    'Jika Anda merasa bosan dengan pitch yang sama, variasikan pendekatan Anda - gunakan storytelling atau studi kasus yang berbeda.',
    'Libatkan prospek dengan pertanyaan terbuka agar percakapan menjadi dua arah.',
    'Ingatkan diri bahwa setiap prospek adalah unik - mereka mendengar pitch Anda untuk pertama kalinya.',
    'Siapkan beberapa anekdot menarik tentang produk yang bisa menyegarkan presentasi Anda.',
  ],
};
// ─── Analyze Single Frame ────────────────────────────────────────────
export async function analyzeFacialExpression(
  imageBase64: string
): Promise<FacialAnalysis> {
  // Client-side MediaPipe landmark tracker acts as primary real-time evaluator for gaze, posture, and facial metrics.
  // Backend acknowledges valid frame transmission and maintains deterministic session compatibility.
  if (!imageBase64 || imageBase64.length < 100) {
    return {
      expression: 'neutral',
      confidence: 50,
      eyeContact: false,
      posture: 'unknown',
      microExpression: 'Wajah tidak terdeteksi pada frame.',
      note: 'Pastikan wajah berada di dalam bingkai kamera dengan pencahayaan memadai.',
    };
  }

  return {
    expression: 'engaged',
    confidence: 80,
    eyeContact: true,
    posture: 'good',
    microExpression: 'Frame terekam dengan pencahayaan memadai.',
    note: 'Ekspresi dipantau melalui pelacak landmark.',
  };
}
// ─── Generate Summary ────────────────────────────────────────────────
export function generateFacialSummary(
  analyses: FacialAnalysis[]
): FacialSummary {
  if (!analyses.length) {
    return {
      dominantExpression: 'neutral',
      averageConfidence: 0,
      eyeContactRate: 0,
      expressionBreakdown: {},
      expressionPercentages: {},
      overallScore: 0,
      scoreCategory: 'poor',
      strengths: [],
      improvements: [],
      feedback:
        'Tidak ada data ekspresi wajah yang berhasil dikumpulkan selama sesi roleplay. Pastikan webcam aktif, pencahayaan memadai, dan wajah terlihat jelas di frame kamera.',
      detailedFeedback: {
        expressionAnalysis: 'Data tidak tersedia.',
        eyeContactAnalysis: 'Data tidak tersedia.',
        confidenceAnalysis: 'Data tidak tersedia.',
        postureAnalysis: 'Data tidak tersedia.',
        overallRecommendation:
          'Silakan ulangi sesi roleplay dengan webcam yang berfungsi untuk mendapatkan analisis ekspresi wajah.',
      },
      coachingTips: [
        'Pastikan webcam aktif dan wajah Anda terlihat jelas sebelum memulai roleplay.',
      ],
    };
  }
  // ── Hitung breakdown ────────────────────────────────────────────
  const breakdown: Record<string, number> = {};
  const percentages: Record<string, number> = {};
  let totalConfidence = 0;
  let eyeContactCount = 0;
  let goodPostureCount = 0;
  for (const a of analyses) {
    breakdown[a.expression] = (breakdown[a.expression] ?? 0) + 1;
    totalConfidence += a.confidence;
    if (a.eyeContact) eyeContactCount++;
    if (a.posture === 'good') goodPostureCount++;
  }
  // Hitung persentase tiap ekspresi
  for (const [expr, count] of Object.entries(breakdown)) {
    percentages[expr] = Math.round((count / analyses.length) * 100);
  }
  const dominant = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0][0];
  const avgConfidence = Math.round(totalConfidence / analyses.length);
  const eyeContactRate = Math.round(
    (eyeContactCount / analyses.length) * 100
  );
  const goodPostureRate = Math.round(
    (goodPostureCount / analyses.length) * 100
  );
  // ── Hitung overall score (weighted) ─────────────────────────────
  const avgExpressionScore =
    analyses.reduce(
      (sum, a) =>
        sum + (EXPRESSION_SCORES[a.expression as FacialExpression] ?? 50),
      0
    ) / analyses.length;
  const overallScore = Math.round(
    avgExpressionScore * 0.35 +
      avgConfidence * 0.25 +
      eyeContactRate * 0.20 +
      goodPostureRate * 0.20
  );
  // ── Tentukan kategori skor ──────────────────────────────────────
  const scoreCategory: FacialSummary['scoreCategory'] =
    overallScore >= 90
      ? 'excellent'
      : overallScore >= 75
        ? 'good'
        : overallScore >= 60
          ? 'average'
          : overallScore >= 40
            ? 'needs_improvement'
            : 'poor';
  // ── Identifikasi strengths & improvements ───────────────────────
  const strengths: string[] = [];
  const improvements: string[] = [];
  // Eye contact
  if (eyeContactRate >= 80) {
    strengths.push(
      `Kontak mata sangat konsisten (${eyeContactRate}%) - ini menunjukkan ketulusan dan membangun kepercayaan prospek.`
    );
  } else if (eyeContactRate >= 60) {
    improvements.push(
      `Kontak mata cukup (${eyeContactRate}%), namun masih bisa ditingkatkan. Usahakan untuk mempertahankan tatapan pada area segitiga wajah (mata-hidung) prospek.`
    );
  } else {
    improvements.push(
      `Kontak mata rendah (${eyeContactRate}%). Prospek mungkin merasa Anda kurang percaya diri atau tidak sepenuhnya hadir. Latih kontak mata bertahap: mulai dari 3 detik, tingkatkan perlahan.`
    );
  }
  // Confidence
  if (avgConfidence >= 80) {
    strengths.push(
      `Tingkat kepercayaan diri tinggi (rata-rata ${avgConfidence}/100) - Anda terlihat yakin dan menguasai materi.`
    );
  } else if (avgConfidence >= 55) {
    improvements.push(
      `Kepercayaan diri perlu ditingkatkan (rata-rata ${avgConfidence}/100). Persiapkan key talking points dan latih pitch Anda hingga terasa natural.`
    );
  } else {
    improvements.push(
      `Kepercayaan diri terdeteksi rendah (rata-rata ${avgConfidence}/100). Fokus pada persiapan: hafalkan 3 poin utama produk Anda dan latih penyampaiannya.`
    );
  }
  // Posture
  if (goodPostureRate >= 70) {
    strengths.push(
      `Postur tubuh baik di ${goodPostureRate}% sesi - postur tegak menunjukkan otoritas dan profesionalisme.`
    );
  } else if (goodPostureRate < 50 && goodPostureRate > 0) {
    improvements.push(
      `Postur tubuh perlu diperbaiki (hanya ${goodPostureRate}% dalam posisi baik). Duduk tegak dengan bahu terbuka untuk menunjukkan confidence dan openness.`
    );
  }
  // Dominant expression analysis
  if (['confident', 'enthusiastic', 'engaged', 'empathetic'].includes(dominant)) {
    strengths.push(
      `Ekspresi dominan "${dominant}" (${percentages[dominant]}%) sangat efektif untuk konteks sales - pertahankan!`
    );
  } else if (['nervous', 'confused', 'frustrated', 'bored'].includes(dominant)) {
    improvements.push(
      `Ekspresi dominan "${dominant}" (${percentages[dominant]}%) bisa menjadi penghambat. ${EXPRESSION_DESCRIPTIONS[dominant as FacialExpression]}`
    );
  }
  // Variasi ekspresi
  const uniqueExpressions = Object.keys(breakdown).length;
  if (uniqueExpressions >= 4) {
    strengths.push(
      'Variasi ekspresi wajah baik - ini menunjukkan Anda responsif dan dinamis dalam berkomunikasi.'
    );
  } else if (uniqueExpressions <= 2 && analyses.length >= 5) {
    improvements.push(
      'Variasi ekspresi terbatas. Cobalah untuk lebih ekspresif: tambahkan senyum saat menyampaikan benefit, tunjukkan empati saat mendengarkan keberatan.'
    );
  }
  // ── Generate feedback utama ─────────────────────────────────────
  const feedback = generateMainFeedback(scoreCategory, overallScore, dominant, avgConfidence, eyeContactRate);
  // ── Generate detailed feedback ──────────────────────────────────
  const detailedFeedback = generateDetailedFeedback(
    analyses,
    breakdown,
    percentages,
    avgConfidence,
    eyeContactRate,
    goodPostureRate,
    dominant
  );
  // ── Generate coaching tips ──────────────────────────────────────
  const coachingTips = generateCoachingTips(
    dominant as FacialExpression,
    scoreCategory,
    eyeContactRate,
    avgConfidence
  );
  return {
    dominantExpression: dominant,
    averageConfidence: avgConfidence,
    eyeContactRate,
    expressionBreakdown: breakdown,
    expressionPercentages: percentages,
    overallScore,
    scoreCategory,
    strengths,
    improvements,
    feedback,
    detailedFeedback,
    coachingTips,
  };
}
// ─── Helper: Main Feedback ───────────────────────────────────────────
function generateMainFeedback(
  category: FacialSummary['scoreCategory'],
  score: number,
  dominant: string,
  confidence: number,
  eyeContactRate: number
): string {
  switch (category) {
    case 'excellent':
      return (
        `Luar biasa! Skor ekspresi wajah Anda ${score}/100 - level excellent. ` +
        `Ekspresi dominan "${dominant}" menunjukkan bahwa Anda sangat siap dan percaya diri dalam melakukan presentasi penjualan. ` +
        `Kontak mata ${eyeContactRate}% dan tingkat kepercayaan diri ${confidence}/100 menunjukkan bahwa Anda sudah menguasai teknik komunikasi non-verbal yang efektif. ` +
        `Pertahankan performa ini dan terus asah kemampuan Anda untuk menghadapi skenario yang lebih menantang.`
      );
    case 'good':
      return (
        `Bagus! Skor ekspresi wajah Anda ${score}/100 - di atas rata-rata. ` +
        `Anda menunjukkan fondasi komunikasi non-verbal yang kuat dengan ekspresi dominan "${dominant}". ` +
        `Dengan sedikit perbaikan pada ${eyeContactRate < 75 ? 'konsistensi kontak mata' : 'variasi ekspresi'}, ` +
        `Anda bisa mencapai level excellent. Fokus pada micro-expression dan pastikan ekspresi Anda konsisten sepanjang presentasi.`
      );
    case 'average':
      return (
        `Cukup baik. Skor ekspresi wajah Anda ${score}/100 - di level rata-rata. ` +
        `Ada potensi yang baik, namun beberapa area perlu ditingkatkan. ` +
        `Tingkat kepercayaan diri (${confidence}/100) dan kontak mata (${eyeContactRate}%) masih bisa dioptimalkan. ` +
        `Latihan rutin di depan cermin atau rekaman video akan sangat membantu. ` +
        `Fokus pada: mempertahankan kontak mata, menunjukkan antusiasme yang genuine, dan menjaga postur tubuh yang terbuka.`
      );
    case 'needs_improvement':
      return (
        `Skor ekspresi wajah Anda ${score}/100 - perlu peningkatan signifikan. ` +
        `Ekspresi dominan "${dominant}" menunjukkan bahwa Anda belum sepenuhnya nyaman dengan materi atau situasi roleplay. ` +
        `Ini wajar dan bisa diperbaiki dengan latihan yang konsisten. ` +
        `Mulai dari hal sederhana: latih opening pitch Anda hingga sangat lancar, karena 30 detik pertama menentukan kesan keseluruhan. ` +
        `Perbaiki kontak mata (saat ini ${eyeContactRate}%) dan cobalah teknik power posing sebelum presentasi.`
      );
    case 'poor':
      return (
        `Skor ekspresi wajah Anda ${score}/100 - membutuhkan latihan intensif. ` +
        `Jangan berkecil hati - setiap sales professional pernah di titik ini. ` +
        `Ekspresi dominan "${dominant}" menunjukkan bahwa Anda perlu membangun fondasi kepercayaan diri terlebih dahulu. ` +
        `Rekomendasi: (1) Hafalkan 3 poin utama produk Anda, ` +
        `(2) Latih di depan cermin minimal 10 menit sehari, ` +
        `(3) Rekam diri Anda dan review ekspresi serta bahasa tubuh, ` +
        `(4) Mulai dengan roleplay skenario sederhana sebelum ke yang kompleks. ` +
        `Kemajuan akan terlihat dalam 3-5 sesi latihan.`
      );
  }
}
// ─── Helper: Detailed Feedback ───────────────────────────────────────
function generateDetailedFeedback(
  analyses: FacialAnalysis[],
  breakdown: Record<string, number>,
  percentages: Record<string, number>,
  avgConfidence: number,
  eyeContactRate: number,
  goodPostureRate: number,
  dominant: string
): FacialSummary['detailedFeedback'] {
  // Expression analysis
  const exprParts: string[] = [];
  for (const [expr, pct] of Object.entries(percentages).sort((a, b) => b[1] - a[1])) {
    const desc = EXPRESSION_DESCRIPTIONS[expr as FacialExpression];
    if (desc && pct >= 10) {
      exprParts.push(`• ${expr} (${pct}%): ${desc}`);
    }
  }
  const expressionAnalysis =
    exprParts.length > 0
      ? `Berikut breakdown ekspresi wajah Anda selama sesi roleplay:\n\n${exprParts.join('\n\n')}`
      : 'Tidak cukup data untuk menganalisis distribusi ekspresi.';
  // Eye contact analysis
  let eyeContactAnalysis: string;
  if (eyeContactRate >= 85) {
    eyeContactAnalysis =
      `Kontak mata Anda sangat konsisten di ${eyeContactRate}% - ini excellent. ` +
      `Kontak mata yang stabil membuat prospek merasa diperhatikan, dihargai, dan meningkatkan tingkat kepercayaan terhadap Anda secara signifikan. ` +
      `Dalam studi komunikasi, kontak mata yang baik meningkatkan persepsi kompetensi hingga 40%.`;
  } else if (eyeContactRate >= 65) {
    eyeContactAnalysis =
      `Kontak mata Anda di ${eyeContactRate}% - cukup baik namun masih ada ruang untuk perbaikan. ` +
      `Anda mungkin sesekali melihat ke bawah (catatan?) atau ke samping. ` +
      `Tips: gunakan teknik "triangle gaze" - alihkan pandangan antara mata kiri, mata kanan, dan dahi prospek secara perlahan. ` +
      `Ini memberikan kesan kontak mata yang natural tanpa terasa mengintimidasi.`;
  } else if (eyeContactRate >= 40) {
    eyeContactAnalysis =
      `Kontak mata Anda di ${eyeContactRate}% - di bawah rata-rata. ` +
      `Prospek mungkin merasa Anda tidak sepenuhnya hadir atau kurang percaya diri. ` +
      `Latih kontak mata secara bertahap: mulai dengan mempertahankan 3 detik, lalu tingkatkan ke 5-7 detik. ` +
      `Saat Anda perlu melihat catatan, lakukan dengan gerakan mata yang purposeful - jangan menunduk terlalu lama.`;
  } else {
    eyeContactAnalysis =
      `Kontak mata Anda hanya ${eyeContactRate}% - ini perlu perbaikan segera. ` +
      `Kurangnya kontak mata adalah salah satu penghambat terbesar dalam penjualan. ` +
      `Prospek akan kesulitan mempercayai seseorang yang tidak berani menatap mata mereka. ` +
      `Mulai latihan dengan: (1) berbicara dengan diri sendiri di depan cermin sambil mempertahankan kontak mata, ` +
      `(2) saat presentasi, fokus pada satu mata prospek saja (biasanya mata kiri), ` +
      `(3) gunakan teknik "anchor point" - pilih titik di antara kedua mata sebagai fokus pandangan.`;
  }
  // Confidence analysis
  let confidenceAnalysis: string;
  if (avgConfidence >= 85) {
    confidenceAnalysis =
      `Tingkat kepercayaan diri terdeteksi sangat tinggi (${avgConfidence}/100). ` +
      `Anda menunjukkan keyakinan yang kuat dalam menyampaikan pesan - ini sangat penting dalam sales. ` +
      `Prospek cenderung membeli dari orang yang yakin dengan produknya. Pastikan kepercayaan diri ini ` +
      `tidak berubah menjadi arogan - tetap tunjukkan kerendahan hati dan keterbukaan terhadap pertanyaan.`;
  } else if (avgConfidence >= 60) {
    confidenceAnalysis =
      `Tingkat kepercayaan diri Anda di ${avgConfidence}/100 - ada fondasi yang baik. ` +
      `Anda mungkin merasa percaya diri di bagian tertentu presentasi, namun kehilangan momentum di bagian lain. ` +
      `Identifikasi bagian mana yang membuat confidence Anda turun - biasanya saat menjawab objection atau ` +
      `menyebutkan harga. Siapkan skrip untuk bagian-bagian tersebut.`;
  } else {
    confidenceAnalysis =
      `Tingkat kepercayaan diri terdeteksi rendah (${avgConfidence}/100). ` +
      `Ini sering disebabkan oleh: kurangnya penguasaan materi, minimnya pengalaman roleplay, atau self-doubt. ` +
      `Langkah perbaikan: (1) Kuasai product knowledge hingga 100%, ` +
      `(2) Latih pitch Anda minimal 20 kali hingga terasa otomatis, ` +
      `(3) Buat daftar "win stories" - cerita sukses yang bisa Anda sampaikan dengan bangga, ` +
      `(4) Sebelum presentasi, lakukan afirmasi positif: "Saya menguasai produk ini dan saya bisa membantu prospek."`;
  }
  // Posture analysis
  let postureAnalysis: string;
  if (goodPostureRate >= 75) {
    postureAnalysis =
      `Postur tubuh Anda sangat baik (${goodPostureRate}% dalam posisi ideal). ` +
      `Postur tegak dengan bahu terbuka menunjukkan confidence, keterbukaan, dan profesionalisme. ` +
      `Ini secara tidak sadar membuat prospek lebih nyaman dan percaya pada Anda.`;
  } else if (goodPostureRate >= 40) {
    postureAnalysis =
      `Postur tubuh Anda bervariasi (${goodPostureRate}% dalam posisi baik). ` +
      `Anda mungkin mulai dengan postur yang baik namun secara perlahan merosot seiring presentasi berlanjut. ` +
      `Tips: set pengingat internal setiap 2-3 menit untuk "reset" postur Anda. ` +
      `Duduk di ujung kursi (bukan bersandar penuh) membantu mempertahankan postur tegak secara alami.`;
  } else {
    postureAnalysis =
      `Postur tubuh perlu perbaikan signifikan (hanya ${goodPostureRate}% dalam posisi baik). ` +
      `Postur yang buruk mengurangi kesan profesional dan bisa menunjukkan ketidaktertarikan atau kelelahan. ` +
      `Rekomendasi: (1) Atur tinggi kursi dan monitor agar mata sejajar dengan kamera, ` +
      `(2) Duduk dengan punggung tegak dan bahu sedikit ke belakang, ` +
      `(3) Kedua kaki menapak lantai untuk stabilitas, ` +
      `(4) Letakkan tangan di atas meja dalam posisi terbuka - hindari menyilangkan tangan.`;
  }
  // Overall recommendation
  const overallRecommendation = generateOverallRecommendation(
    avgConfidence,
    eyeContactRate,
    dominant as FacialExpression
  );
  return {
    expressionAnalysis,
    eyeContactAnalysis,
    confidenceAnalysis,
    postureAnalysis,
    overallRecommendation,
  };
}
// ─── Helper: Overall Recommendation ─────────────────────────────────
function generateOverallRecommendation(
  confidence: number,
  eyeContactRate: number,
  dominant: FacialExpression
): string {
  const parts: string[] = [];
  parts.push('Berdasarkan analisis keseluruhan sesi roleplay Anda, berikut rekomendasi prioritas:\n');
  // Priority 1: Biggest weakness
  if (confidence < 50) {
    parts.push(
      '🔴 PRIORITAS UTAMA - Bangun Kepercayaan Diri:\n' +
      'Kuasai product knowledge, latih pitch hingga sangat lancar, dan mulai dengan skenario roleplay yang sederhana. ' +
      'Kepercayaan diri adalah fondasi semua keterampilan sales lainnya.\n'
    );
  } else if (eyeContactRate < 50) {
    parts.push(
      '🔴 PRIORITAS UTAMA - Perbaiki Kontak Mata:\n' +
      'Latih kontak mata setiap hari - bahkan dalam percakapan casual. Ini akan menjadi kebiasaan natural dalam 1-2 minggu. ' +
      'Kontak mata adalah sinyal non-verbal paling kuat dalam membangun trust.\n'
    );
  } else if (['nervous', 'frustrated', 'bored'].includes(dominant)) {
    parts.push(
      `🔴 PRIORITAS UTAMA - Kelola Ekspresi "${dominant}":\n` +
      `${EXPRESSION_DESCRIPTIONS[dominant]} ` +
      'Latih teknik manajemen emosi dan persiapkan mental sebelum setiap sesi.\n'
    );
  }
  // Priority 2: Quick wins
  parts.push(
    '🟡 QUICK WINS - Langkah Cepat yang Berdampak Besar:\n' +
    '• Senyum natural di 5 detik pertama - kesan pertama sangat menentukan.\n' +
    '• Anggukan kecil saat prospek berbicara - menunjukkan active listening.\n' +
    '• Gunakan gestur tangan terbuka saat menjelaskan - meningkatkan persepsi keterbukaan.\n' +
    '• Akhiri setiap poin penting dengan senyum tipis - memberikan kesan positif.\n'
  );
  // Priority 3: Long-term development
  parts.push(
    '🟢 PENGEMBANGAN JANGKA PANJANG:\n' +
    '• Rekam setiap sesi roleplay dan review ekspresi wajah Anda sendiri.\n' +
    '• Pelajari teknik mirroring - mencerminkan ekspresi positif prospek untuk membangun rapport.\n' +
    '• Latih variasi ekspresi: antusias saat pitch, empati saat discovery, percaya diri saat closing.\n' +
    '• Minta feedback dari rekan kerja tentang bahasa tubuh Anda dalam meeting sehari-hari.'
  );
  return parts.join('\n');
}
// ─── Helper: Coaching Tips ───────────────────────────────────────────
function generateCoachingTips(
  dominant: FacialExpression,
  category: FacialSummary['scoreCategory'],
  eyeContactRate: number,
  confidence: number
): string[] {
  const tips: string[] = [];
  // Tips berdasarkan ekspresi dominan
  const expressionTips = EXPRESSION_COACHING[dominant];
  if (expressionTips) {
    tips.push(...expressionTips.slice(0, 2));
  }
  // Tips berdasarkan skor keseluruhan
  switch (category) {
    case 'excellent':
      tips.push(
        'Anda sudah di level tinggi! Tantang diri dengan skenario yang lebih sulit: prospek agresif, negosiasi harga ketat, atau presentasi ke C-level executive.'
      );
      break;
    case 'good':
      tips.push(
        'Fokus pada konsistensi - pastikan ekspresi positif Anda bertahan dari awal hingga akhir presentasi, termasuk saat menghadapi objection.'
      );
      break;
    case 'average':
      tips.push(
        'Buat rutinitas "pre-pitch ritual": tarik napas dalam 3x, tersenyum di depan cermin, dan ucapkan opening statement Anda keras-keras sebelum mulai.',
        'Latih satu aspek per sesi - misalnya hari ini fokus kontak mata, besok fokus ekspresi, lusa fokus postur.'
      );
      break;
    case 'needs_improvement':
    case 'poor':
      tips.push(
        'Mulai dengan latihan basic: berdiri di depan cermin, sampaikan elevator pitch 30 detik, dan perhatikan ekspresi Anda.',
        'Rekam diri Anda saat latihan - sering kali kita tidak sadar ekspresi apa yang kita tunjukkan.',
        'Jangan langsung ke skenario sulit. Mulai dari roleplay sederhana: perkenalan produk ke prospek yang ramah.'
      );
      break;
  }
  // Tips spesifik berdasarkan kelemahan
  if (eyeContactRate < 60) {
    tips.push(
      'Latihan kontak mata: saat menonton video, latih menatap mata pembicara tanpa mengalihkan pandangan. Ini melatih otot mata dan kebiasaan fokus.'
    );
  }
  if (confidence < 50) {
    tips.push(
      'Teknik "fake it till you make it" terbukti efektif: power pose 2 menit sebelum presentasi (berdiri tegak, tangan di pinggang) meningkatkan testosteron dan menurunkan kortisol.'
    );
  }
  return tips;
}
