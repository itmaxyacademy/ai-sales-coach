import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const RECORDING_DIR = path.resolve("./playwright-recordings/full_sales_journey");
if (!fs.existsSync(RECORDING_DIR)) {
  fs.mkdirSync(RECORDING_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("🚀 Starting Playwright screen recording process...");

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-gl=angle",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--window-size=1280,720",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: RECORDING_DIR,
      size: { width: 1280, height: 720 },
    },
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const SESSION_ID = "rec-session-full-journey-99";

  // Mock route for the interactive session
  await page.route(`**/sessions/${SESSION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: SESSION_ID,
          courseId: "mock-indomie-b2b",
          status: "in_progress",
          trustLevel: 2.8,
          customerStage: "cold",
          mood: "skeptical",
          turnCount: 0,
          hasStarted: false,
          ttsVoice: "M1",
          course: {
            title: "Strategi Penjualan Indomie Horeca & FMCG Enterprise",
            category: "B2B Sales",
            personaName: "Ir. Hendra Gunawan",
            personaRole: "VP Procurement & Supply Chain",
            personaPersonality: "Kritis, analitis, mementingkan konsistensi pasokan dan reliabilitas distribusi.",
            personaBackground: "Mengelola pengadaan bahan baku untuk 45 cabang jaringan hotel dan restoran multinasional.",
            personaPainPoints: "Sering terjadi kelangkaan pasokan saat peak season dan inkonsistensi waktu pengiriman vendor lama.",
            personaObjections: "Khawatir vendor baru tidak sanggup menjaga kestabilan harga saat lonjakan bahan baku.",
            personaBuyingSignals: "Menanyakan garansi SLA buffer stock dan skema termin pembayaran 45 hari.",
            maxTurns: 10,
          },
        },
        transcript: [
          {
            role: "assistant",
            content: "Selamat pagi. Kami sedang mengevaluasi kembali seluruh vendor pasokan F&B untuk kuartal depan. Apa jaminan keandalan distribusi dan stabilitas harga dari pihak Anda?",
            trustDelta: 0,
          },
        ],
      }),
    });
  });

  await page.route(`**/sessions/${SESSION_ID}/begin`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  let messageTurn = 0;
  await page.route("**/api/backend/sessions/chat", async (route) => {
    messageTurn++;
    if (messageTurn === 1) {
      const sseBody = [
        `data: ${JSON.stringify({ chunk: "Tawaran SLA 24 jam cukup meyakinkan. " })}\n\n`,
        `data: ${JSON.stringify({ chunk: "Tapi bagaimana skema harga untuk volume di atas 5.000 karton per bulan?" })}\n\n`,
        `data: ${JSON.stringify({ customerState: { stage: "evaluating", mood: "interested", trustLevel: 3.8 }, trustDelta: 1.0 })}\n\n`,
      ].join("");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sseBody,
      });
    } else {
      const sseBody = [
        `data: ${JSON.stringify({ chunk: "Sangat baik, proposal skema rabat tersebut masuk akal dan memenuhi kriteria kami. " })}\n\n`,
        `data: ${JSON.stringify({ chunk: "Kirimkan draft kontraknya hari ini untuk segera kami finalisasi." })}\n\n`,
        `data: ${JSON.stringify({ customerState: { stage: "decided", mood: "satisfied", trustLevel: 4.6 }, trustDelta: 0.8 })}\n\n`,
      ].join("");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sseBody,
      });
    }
  });

  await page.route("**/sessions/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, sessionId: SESSION_ID }),
    });
  });

  // Mock Result Evaluation Page
  await page.route(`**/sessions/${SESSION_ID}/result`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: SESSION_ID,
          totalScore: 92,
          outcome: "closed",
          turnCount: 2,
          completedAt: new Date().toISOString(),
          course: {
            title: "Strategi Penjualan Indomie Horeca & FMCG Enterprise",
            category: "B2B Sales",
          },
        },
        insightReport: {
          narrative: "Performa penjualan luar biasa! Pendekatan berbasis SLA buffer stock langsung meredakan kekhawatiran terbesar prospek, sementara skema tier rabat 7.5% berhasil mengunci kesepakatan secara elegan.",
          categoryScores: [
            { category: "Discovery & Needs Analysis", score: 90, weight: 25, comment: "Responsif terhadap pain point rantai pasok prospek.", examples: ["Penyebutan SLA 24 jam"] },
            { category: "Objection Handling", score: 94, weight: 30, comment: "Solusi buffer stock tepat sasaran mengatasi risiko kehabisan stok.", examples: ["0% risiko stok kosong"] },
            { category: "Value Proposition", score: 92, weight: 25, comment: "Penawaran harga dan tempo kredit sangat kompetitif.", examples: ["Rabat 7.5% & tempo 45 hari"] },
            { category: "Closing Technique", score: 91, weight: 20, comment: "Proaktif mendorong aksi berikutnya melalui draft kontrak.", examples: ["Pilot test minggu ini"] },
          ],
          communicationMetrics: {
            fillerWords: { total: 1, rating: "Clean", percentage: 0.8, tips: "Artikulasi sangat bersih dan meyakinkan." },
            pacing: { averageWpm: 126, rating: "Optimal", label: "Tempo ideal" },
            talkToListenRatio: { salesPercentage: 48, prospectPercentage: 52, salesWords: 68, prospectWords: 55, advice: "Proporsi berbicara seimbang dan sangat profesional." },
          },
          recommendations: [
            "Pertahankan kecepatan artikulasi 120-130 WPM yang konsisten.",
            "Terapkan teknik bundling produk pelengkap pada sesi negosiasi berikutnya.",
            "Dokumentasikan SLA tertulis dalam executive summary penawaran."
          ],
        },
        facialSummary: {
          dominantExpression: "confident",
          averageConfidence: 89,
          eyeContactRate: 88,
          overallScore: 91,
          scoreCategory: "excellent",
          strengths: ["Kontak mata konsisten dan postur tubuh sangat meyakinkan", "Ketenangan tinggi saat menghadapi keberatan harga"],
          improvements: ["Berikan senyuman apresiasi hangat di penutupan"],
          feedback: "Ekspresi stabil dan bahasa tubuh mencerminkan kredibilitas perwakilan profesional.",
        },
      }),
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 1. TAHAP 1: MASUK (LOGIN SEBAGAI MANAGER)
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 1: Menavigasi ke Halaman Login...");
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  console.log("➡️ Memilih Akun Demo Manager (Manager Indomie)...");
  const demoDropdownBtn = page.getByRole("button", { name: /pilih akun demo/i });
  await demoDropdownBtn.click();
  await sleep(800);

  const searchInput = page.getByPlaceholder("Cari nama, email, perusahaan, atau tim...");
  if (await searchInput.isVisible()) {
    await searchInput.fill("mgr.indomie@indofood.co.id");
    await sleep(500);
  }

  const managerBtn = page.locator('button:has-text("mgr.indomie@indofood.co.id")').first();
  await managerBtn.click();

  await page.waitForURL("**/manager/dashboard*", { timeout: 15000 });
  console.log("✅ Berhasil Login sebagai Manager! Menampilkan Dashboard...");
  await sleep(2000);

  // Smooth scroll manager dashboard
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: "smooth" }));
  await sleep(1500);
  await page.evaluate(() => window.scrollBy({ top: -350, behavior: "smooth" }));
  await sleep(1000);

  // ════════════════════════════════════════════════════════════════════════
  // 2. TAHAP 2: BIKIN MATERI (CREATE COURSE / TRAINING MATERIAL)
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 2: Menavigasi ke Halaman Pembuatan Kursus / Materi...");
  await page.goto("http://localhost:3000/manager/courses/create");
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  console.log("➡️ Mengisi Form Pembuatan Materi Baru...");
  const titleInput = page.locator('input[placeholder*="Closing Deal with Skeptical Buyer"]');
  await titleInput.fill("Strategi Penjualan Indomie Horeca & FMCG Enterprise");
  await sleep(400);

  const descInput = page.locator('textarea[placeholder*="Explain what the sales rep will learn"]');
  await descInput.fill("Program pelatihan akselerasi sales representative dalam menangani prospek procurement F&B jaringan hotel & resto.");
  await sleep(400);

  const categoryInput = page.locator('input[placeholder*="B2B Sales, Property"]');
  await categoryInput.fill("B2B Sales Enterprise");
  await sleep(400);

  const contextInput = page.locator('textarea[placeholder*="Where is this happening?"]');
  await contextInput.fill("Meeting negosiasi kontrak tahunan pasokan F&B dengan Head of Procurement.");
  await sleep(400);

  const outcomeInput = page.locator('input[placeholder*="What constitutes a successful closing?"]');
  await outcomeInput.fill("Persetujuan jadwal pilot test dan verifikasi draft kontrak formal.");
  await sleep(400);

  // Scroll down to Persona details
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await sleep(1000);

  const personaNameInput = page.locator('input[placeholder*="Pak Budi / Bu Rina"]');
  await personaNameInput.fill("Ir. Hendra Gunawan");
  await sleep(400);

  const personaRoleInput = page.locator('input[placeholder*="Chief Marketing Officer"]');
  await personaRoleInput.fill("VP Procurement & Supply Chain");
  await sleep(400);

  const personalityInput = page.locator('input[placeholder*="Skeptical, analytical, direct"]');
  await personalityInput.fill("Kritis, analitis, fokus pada keandalan pasokan");
  await sleep(400);

  const painPointsInput = page.locator('textarea[placeholder*="What are they struggling with?"]');
  await painPointsInput.fill("Kelangkaan pasokan saat peak season dan keterlambatan pengiriman vendor lama.");
  await sleep(400);

  const objectionsInput = page.locator('textarea[placeholder*="What doubts or objections will they raise?"]');
  await objectionsInput.fill("Khawatir vendor baru tidak sanggup menjaga stabilitas harga dan SLA pengiriman.");
  await sleep(400);

  // Scroll down to Product & Module
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
  await sleep(1000);

  const productNameInput = page.locator('input[placeholder*="SalesCRM Pro"]');
  await productNameInput.fill("Indomie Foodservice Corporate Solution");
  await sleep(400);

  const strengthsInput = page.locator('input[placeholder*="What makes it better than competitors?"]');
  await strengthsInput.fill("Jaringan distribusi nasional terbesar, SLA buffer stock 24 jam, diskon volume bertingkat.");
  await sleep(400);

  const moduleInput = page.locator('textarea[placeholder*="Write down the material the sales rep needs to study"]');
  if (await moduleInput.isVisible()) {
    await moduleInput.fill("# Silabus Materi Pelatihan B2B\n1. Identifikasi Kebutuhan Rantai Pasok\n2. Penanganan Keberatan Harga & Inflasi\n3. Value Framing SLA Buffer Stock 24 Jam\n4. Teknik Closing & Pilot Agreement");
    await sleep(600);
  }

  console.log("✅ Form materi berhasil diisi lengkap!");
  await sleep(2000);

  // ════════════════════════════════════════════════════════════════════════
  // 3. TAHAP 3: BERALIH KE SALES (KARYAWAN) & MASUK SESI SIMULASI
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 3: Beralih ke Akun Sales Rep (Budi Pratama)...");
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("domcontentloaded");
  await sleep(1000);

  await page.getByRole("button", { name: /pilih akun demo/i }).click();
  await sleep(600);

  const searchInputKaryawan = page.getByPlaceholder("Cari nama, email, perusahaan, atau tim...");
  if (await searchInputKaryawan.isVisible()) {
    await searchInputKaryawan.fill("budi.sales1@indofood.co.id");
    await sleep(400);
  }
  await page.locator('button:has-text("budi.sales1@indofood.co.id")').first().click();

  await page.waitForURL("**/karyawan/dashboard*", { timeout: 15000 });
  console.log("✅ Berhasil Login sebagai Sales Karyawan! Menampilkan Dashboard Sales...");
  await sleep(2000);

  // ════════════════════════════════════════════════════════════════════════
  // 4. TAHAP 4: MASUK SESI WAWANCARA DENGAN 3D AVATAR
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 4: Membuka Sesi Roleplay Interaktif dengan 3D Avatar...");
  await page.goto(`http://localhost:3000/karyawan/session/${SESSION_ID}`);
  await page.waitForLoadState("domcontentloaded");
  await sleep(2000);

  // 1. Briefing Modal Pre-session
  console.log("➡️ Menampilkan Modal Ringkasan Sebelum Latihan (Persona Briefing)...");
  const startPracticeBtn = page.getByRole("button", { name: /mulai latihan/i });
  await startPracticeBtn.waitFor({ state: "visible", timeout: 10000 });
  await sleep(2500); // let viewer see briefing card

  console.log("➡️ Klik 'Mulai latihan' untuk mengaktifkan Avatar 3D...");
  await startPracticeBtn.click();
  await sleep(2000);

  // 2. Avatar 3D & Initial AI Buyer Message
  console.log("➡️ Avatar 3D aktif di layar. Pesan pembuka prospek ditampilkan di chat.");
  await sleep(2500);

  // 3. User types first pitch / answer
  const chatInput = page.getByPlaceholder(/ketik pesan|type a message/i).first();
  await chatInput.waitFor({ state: "visible", timeout: 10000 });

  const firstUserMessage = "Selamat pagi Pak Hendra. Kami menyediakan SLA pengiriman 24 jam dengan buffer stock terdedikasi di warehouse regional kami, sehingga risiko kehabisan stok operasional dapat ditekan hingga 0%.";
  console.log(`➡️ Sales Rep mengetik: "${firstUserMessage}"`);
  await chatInput.fill(firstUserMessage);
  await sleep(1500);

  // Click Send via id or enter
  const sendButton = page.locator("#send-msg-btn, button:has(.lucide-send)").first();
  if (await sendButton.isVisible()) {
    await sendButton.click();
  } else {
    await chatInput.press("Enter");
  }
  console.log("✅ Pesan 1 terkirim! Menunggu respons streaming AI Buyer & kenaikan Trust Meter...");
  await sleep(3500);

  // 4. User types second response (Handling Volume & Pricing objection)
  const secondUserMessage = "Untuk volume di atas 5.000 karton, kami sediakan skema tier rabat 7.5% ditambah fasilitas termin pembayaran 45 hari. Kami siap jadwalkan pengiriman pilot test minggu ini Pak.";
  console.log(`➡️ Sales Rep mengetik: "${secondUserMessage}"`);
  await chatInput.fill(secondUserMessage);
  await sleep(1500);

  if (await sendButton.isVisible()) {
    await sendButton.click();
  } else {
    await chatInput.press("Enter");
  }
  console.log("✅ Pesan 2 terkirim! AI Buyer menyetujui proposal pengiriman draft kontrak.");
  await sleep(3500);

  // ════════════════════════════════════════════════════════════════════════
  // 5. TAHAP 5: SELESAIKAN WAWANCARA (END SESSION)
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 5: Mengakhiri Sesi Wawancara...");
  const endSessionTrigger = page.locator('button[title="End session"], button:has(.lucide-phone-off)').first();
  if (await endSessionTrigger.isVisible()) {
    await endSessionTrigger.click();
  } else {
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="End session"]') || document.querySelector('button .lucide-phone-off')?.closest('button');
      if (btn) btn.click();
    });
  }
  await sleep(1500);

  // Confirm End Session modal
  const confirmBtn = page.locator('button:has-text("End Session")').last();
  console.log("➡️ Mengonfirmasi 'End Session' pada modal konfirmasi...");
  await confirmBtn.click();
  await sleep(2000);

  // ════════════════════════════════════════════════════════════════════════
  // 6. TAHAP 6: KELUAR HASIL EVALUASI (RESULT PAGE)
  // ════════════════════════════════════════════════════════════════════════
  console.log("➡️ Step 6: Navigasi ke Halaman Hasil Evaluasi (Result Page)...");
  await page.goto(`http://localhost:3000/karyawan/session/${SESSION_ID}/result`);
  await page.waitForLoadState("domcontentloaded");
  await sleep(2500);

  console.log("✅ Halaman Hasil Evaluasi Berhasil Dimuat!");
  await sleep(2000);

  // Smooth scroll through evaluation result details
  console.log("➡️ Scrolling halaman hasil untuk memperlihatkan Rubrik Skor, Analisis Pacing, dan Rekomendasi...");
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
  await sleep(2500);

  await page.evaluate(() => window.scrollBy({ top: 550, behavior: "smooth" }));
  await sleep(2500);

  console.log("➡️ Scrolling kembali ke ringkasan nilai atas...");
  await page.evaluate(() => window.scrollBy({ top: -700, behavior: "smooth" }));
  await sleep(3000);

  // Finish
  console.log("🏁 Menutup browser dan memproses file rekaman video...");
  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(RECORDING_DIR).filter(f => f.endsWith('.webm'));
  const latestVideo = files.length > 0 ? path.join(RECORDING_DIR, files[files.length - 1]) : null;

  console.log("🎉 REKAMAN LAYAR SELESAI!");
  if (latestVideo) {
    const stats = fs.statSync(latestVideo);
    console.log(`📹 File Video: ${latestVideo} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

run().catch((err) => {
  console.error("❌ Execution error:", err);
  process.exit(1);
});
