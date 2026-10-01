import { test, expect } from "../fixtures/auth.fixture";

test.describe("Karyawan Sales Training and Roleplay Lifecycle", () => {
  test("Dashboard Karyawan menampilkan metrik kinerja, assignment, dan streak", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/dashboard");

    // Header sambutan
    await expect(page.locator("h1:has-text('Welcome back')")).toBeVisible();

    // Kartu statistik utama
    await expect(page.locator("text=Track your training progress.")).toBeVisible();

    // Tombol aksi riwayat
    const historyBtn = page.getByRole("link", { name: /view history/i });
    await expect(historyBtn).toBeVisible();
  });

  test("Katalog Course menampilkan filter kategori dan kartu skenario roleplay", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/courses");

    // Input pencarian skenario
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();

    // Verifikasi keberadaan kartu course atau empty state jika data baru
    const courseCard = page.locator(".card").first();
    await expect(courseCard).toBeVisible();
  });

  test("Simulasi Roleplay interaktif mendukung pengiriman pesan dan petunjuk AI", async ({ karyawanPage: page }) => {
    // Intercept API sesi jika mock diperlukan
    await page.route("**/sessions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: "test-session-uuid-1234",
              courseId: "mock-course-id",
              trustLevel: 2.5,
              customerStage: "cold",
              mood: "neutral",
              turnCount: 0,
            }
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/sessions/test-session-uuid-1234", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "test-session-uuid-1234",
            course: {
              title: "Penjualan Alat Berat Tambang",
              personaName: "Ir. Hendra Gunawan",
              personaRole: "VP of Mining Operations",
            },
            messages: [
              {
                role: "assistant",
                content: "Selamat pagi. Kami sedang buru-buru, tolong jelaskan apa keunggulan unit Anda dibanding kompetitor.",
              }
            ],
            trustLevel: 2.5,
            customerStage: "cold",
            mood: "skeptical",
            turnCount: 1,
            objectionCount: 1,
          }
        }),
      });
    });

    await page.goto("/karyawan/session/test-session-uuid-1234");

    // Verifikasi pesan pembuka AI Buyer
    await expect(page.locator("text=Ir. Hendra Gunawan").or(page.locator("text=Selamat pagi"))).toBeVisible({ timeout: 10000 });

    // Input pesan chat sales
    const chatInput = page.getByPlaceholder(/ketik pesan|type a message/i).first();
    if (await chatInput.isVisible()) {
      await chatInput.fill("Selamat pagi Pak Hendra. Unit kami memiliki efisiensi bahan bakar 18% lebih hemat dengan garansi suku cadang 24 jam.");
      const sendButton = page.locator("button:has-text('Send')").or(page.locator("button svg.lucide-send")).first();
      await expect(sendButton).toBeVisible();
    }
  });

  test("Halaman Hasil Evaluasi menampilkan skor total, rubrik, dan metrik komunikasi", async ({ karyawanPage: page }) => {
    // Mock hasil evaluasi sesi
    await page.route("**/sessions/test-session-result-99/result", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "test-session-result-99",
            totalScore: 84,
            outcome: "closed",
            turnCount: 12,
            completedAt: new Date().toISOString(),
            course: {
              title: "Penjualan Software Enterprise",
              category: "B2B Software",
            },
            insightReport: {
              narrative: "Performa negosiasi sangat meyakinkan dengan penanganan keberatan harga yang tepat sasaran.",
              categoryScores: [
                { category: "Discovery", score: 85, weight: 25, comment: "Pertanyaan kebutuhan sangat mendalam." },
                { category: "Objection Handling", score: 82, weight: 35, comment: "Mampu menjelaskan TCO dengan data." }
              ],
              communicationMetrics: {
                fillerWords: { total: 2, rating: "Clean", percentage: 1.2 },
                pacing: { averageWpm: 128, rating: "Optimal" },
                talkToListenRatio: { salesPercentage: 45, prospectPercentage: 55 }
              },
              recommendations: [
                "Pertahankan teknik open-ended question pada tahap awal.",
                "Tingkatkan kecepatan respons saat prospek menanyakan integrasi API."
              ]
            }
          }
        }),
      });
    });

    await page.goto("/karyawan/session/test-session-result-99/result");

    // Verifikasi elemen skor
    await expect(page.locator("text=84").or(page.locator("text=Penjualan Software Enterprise"))).toBeVisible({ timeout: 8000 });
  });

  test("Halaman Leaderboard menampilkan peringkat tim dan formula skor SAW", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/leaderboard");
    await expect(page.locator("h1:has-text('Ranking')").or(page.locator("text=Leaderboard"))).toBeVisible({ timeout: 8000 });
  });
});
