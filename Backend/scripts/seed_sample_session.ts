import { prisma } from './src/lib/prisma.js';
import { analyzeCommunicationMetrics, buildTimelineMoments } from './src/services/insightService.js';

async function main() {
  // Find a user and company
  const user = await prisma.user.findFirst({ where: { role: 'karyawan' } });
  if (!user) {
    console.error('No karyawan user found');
    return;
  }

  const company = await prisma.company.findFirst();

  // Create or find a course
  let course = await prisma.course.findFirst({ where: { title: 'Enterprise CRM Solution Pitch' } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        title: 'Enterprise CRM Solution Pitch',
        description: 'Latihan pitching solusi CRM enterprise kepada VP Marketing yang skeptis.',
        category: 'Software B2B',
        difficulty: 'Intermediate',
        personaName: 'Sarah Chen',
        personaRole: 'VP of Marketing',
        personaBackground: 'Pemimpin pemasaran senior dengan pengalaman 12 tahun di perusahaan teknologi multinasional.',
        personaPainPoints: 'Lead generation mahal dan tracking performa tim sales kurang transparan.',
        personaObjections: 'Harga terlalu mahal dan proses implementasi memakan waktu lama.',
        personaBuyingSignals: 'Menanyakan integrasi CRM dan garansi SLA.',
        personaPersonality: 'Tegas, data-driven, dan menghargai efisiensi waktu.',
        personaGender: 'F',
        productName: 'SalesAI Enterprise Cloud',
        productDescription: 'Platform otomatisasi sales berbasis AI untuk meningkatkan konversi deal.',
        productStrengths: 'Analisis prediktif, integrasi instan, dan coaching real-time.',
        scenarioContext: 'Meeting pertama secara online setelah cold outreach.',
        idealOutcome: 'Menjadwalkan product demo teknis minggu depan.',
        maxTurns: 15,
        createdById: user.id,
        companyId: company?.id,
      },
    });
  }

  // 1. Create an active session for testing the Session Room UI (Phone Mode, Split Mode, Edge HUD)
  const activeSession = await prisma.session.create({
    data: {
      userId: user.id,
      courseId: course.id,
      status: 'active',
      trustLevel: 3.2,
      customerStage: 'interested',
      mood: 'curious',
      turnCount: 4,
      ttsVoice: 'F1',
    },
  });

  // Add messages to active session
  await prisma.message.createMany({
    data: [
      {
        sessionId: activeSession.id,
        userId: user.id,
        role: 'user',
        content: 'Selamat pagi Bu Sarah, terima kasih atas waktunya. Saya ingin memahami tantangan utama tim marketing Ibu terkait konversi lead saat ini.',
      },
      {
        sessionId: activeSession.id,
        userId: user.id,
        role: 'assistant',
        content: 'Pagi Budi. Masalah terbesar kami adalah lead yang masuk banyak, tapi kualifikasinya lambat sehingga sales kami sering membuang waktu. Bagaimana solusi kalian membantu ini?',
        trustDelta: 0.3,
      },
      {
        sessionId: activeSession.id,
        userId: user.id,
        role: 'user',
        content: 'Platform kami menggunakan AI untuk scoring lead otomatis secara real-time, jadi tim sales langsung fokus ke prospek dengan potensi closing 3x lebih tinggi.',
      },
      {
        sessionId: activeSession.id,
        userId: user.id,
        role: 'assistant',
        content: 'Klaim yang menarik, tapi bagaimana dengan integrasinya ke stack Salesforce kami?',
        trustDelta: 0.4,
      }
    ]
  });

  // 2. Create a completed session for testing the Result Page UI (Timeline Replay, Speech Analytics)
  const mockMessages: any[] = [
    {
      role: 'user',
      content: 'Selamat siang Bu Sarah, um perkenalkan saya Budi dari SalesAI. Anu, sebenarnya kami ingin menawarkan solusi otomatisasi sales CRM yang kayaknya cocok untuk skala enterprise.',
    },
    {
      role: 'assistant',
      content: 'Halo Budi, silakan jelaskan apa pembeda kalian dibanding solusi yang sudah kami pakai.',
      trustDelta: 0.1,
    },
    {
      role: 'user',
      content: 'Jadi gini Bu, platform kami bisa mengotomatisasi kualifikasi prospek hingga 40% lebih cepat dengan integrasi real-time ke sistem lama tanpa migrasi rumit.',
    },
    {
      role: 'assistant',
      content: 'Tapi harga solusi enterprise kalian terasa mahal dan budget kami tahun ini sudah hampir habis.',
      trustDelta: -0.3,
    },
    {
      role: 'user',
      content: 'Saya sangat paham pertimbangan budget Bu Sarah. Bagaimana jika kita mulai dengan pilot project 30 hari dengan jaminan peningkatan closing rate sebelum komitmen tahunan?',
    },
    {
      role: 'assistant',
      content: 'Tawaran yang masuk akal dan minim risiko. Boleh kita jadwalkan demo teknis bersama tim IT minggu depan.',
      trustDelta: 0.6,
    }
  ];

  const commMetrics = analyzeCommunicationMetrics(mockMessages as any);
  const timelineMoments = buildTimelineMoments(mockMessages as any);

  const completedSession = await prisma.session.create({
    data: {
      userId: user.id,
      courseId: course.id,
      status: 'completed',
      totalScore: 92,
      outcome: 'closed',
      turnCount: 3,
      completedAt: new Date(),
      trustLevel: 4.2,
      customerStage: 'decided',
      mood: 'positive',
      facialSummary: {
        dominantExpression: 'confident',
        averageConfidence: 88,
        eyeContactRate: 85,
        expressionBreakdown: { confident: 4, engaged: 2 },
        expressionPercentages: { confident: 67, engaged: 33 },
        overallScore: 90,
        scoreCategory: 'excellent',
        strengths: ['Kontak mata sangat stabil dan meyakinkan', 'Postur tegak dan ekspresi percaya diri'],
        improvements: ['Bisa lebih tersenyum saat pembukaan sesi'],
        feedback: 'Gestur dan ketenangan Anda saat menghadapi keberatan harga sangat impresif.',
        detailedFeedback: {
          expressionAnalysis: 'Ekspresi dominan tenang dan meyakinkan.',
          eyeContactAnalysis: 'Tingkat kontak mata 85% menunjukkan fokus tinggi.',
          confidenceAnalysis: 'Rasa percaya diri terjaga konsisten.',
          postureAnalysis: 'Postur tegak dan sejajar kamera.',
          overallRecommendation: 'Pertahankan ketenangan ini di pitching klien nyata.'
        },
        coachingTips: ['Gunakan jeda hening saat prospek berpikir.']
      },
      feedbackReport: {
        totalScore: 92,
        outcome: 'closed',
        narrative: 'Performa sangat solid. Anda berhasil mengatasi keberatan budget dengan menawarkan pilot test terukur yang membuat prospek langsung sepakat untuk next step.',
        categoryScores: [
          { category: 'Opening', weight: 20, score: 88, comment: 'Pembukaan ramah dan langsung ke inti value.', examples: ['Selamat siang Bu Sarah...'] },
          { category: 'Discovery', weight: 30, score: 92, comment: 'Penggalian kebutuhan dan positioning produk sangat tepat.', examples: ['Platform kami bisa mengotomatisasi kualifikasi...'] },
          { category: 'Objection Handling', weight: 30, score: 95, comment: 'Sangat tanggap mengubah risiko harga menjadi pilot terukur.', examples: ['Bagaimana jika kita mulai dengan pilot project 30 hari...'] },
          { category: 'Closing', weight: 20, score: 90, comment: 'Berhasil mengunci komitmen meeting demo teknis.', examples: ['Boleh kita jadwalkan demo teknis...'] }
        ],
        keyMoments: [
          { turn: 3, type: 'strength', description: 'Solusi pilot terukur untuk mengatasi masalah budget', salesMessage: 'Bagaimana jika kita mulai dengan pilot project 30 hari...' }
        ],
        recommendations: ['Pertahankan struktur penanganan keberatan berbasis garansi / pilot testing.'],
        evaluationSource: 'ai',
        communicationMetrics: commMetrics,
        timelineMoments: timelineMoments,
      }
    }
  });

  for (const m of mockMessages) {
    await prisma.message.create({
      data: {
        sessionId: completedSession.id,
        userId: user.id,
        role: m.role,
        content: m.content,
        trustDelta: m.trustDelta ?? 0,
      }
    });
  }

  console.log(`ACTIVE_SESSION_ID=${activeSession.id}`);
  console.log(`COMPLETED_SESSION_ID=${completedSession.id}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
