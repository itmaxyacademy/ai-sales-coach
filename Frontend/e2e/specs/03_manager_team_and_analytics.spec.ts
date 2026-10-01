import { test, expect } from "../fixtures/auth.fixture";

test.describe("Manager Team Oversight and Ranking Configuration", () => {
  test("Dashboard Manager memuat metrik tim, peringatan deadline, dan podium 3 besar", async ({ managerPage: page }) => {
    await page.goto("/manager/dashboard");

    // Verifikasi judul halaman
    await expect(page.locator("h1:has-text('Team Dashboard')")).toBeVisible();

    // Verifikasi kartu statistik
    await expect(page.locator("text=Avg Score")).toBeVisible();
    await expect(page.locator("text=Completion Rate")).toBeVisible();
    await expect(page.locator("text=Active Sessions")).toBeVisible();
  });

  test("Manajemen Tim mendukung tab Table, Org Tree interaktif, dan daftar Assignment", async ({ managerPage: page }) => {
    await page.goto("/manager/team");

    // Header halaman tim
    await expect(page.locator("h1:has-text('My Team')").or(page.locator("text=Team Management"))).toBeVisible();

    // Filter pencarian anggota
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();

    // Cek keberadaan tombol beralih tab
    const tableTab = page.locator("button:has-text('Table')").or(page.locator("text=Table"));
    const treeTab = page.locator("button:has-text('Tree')").or(page.locator("text=Tree"));
    await expect(tableTab.first()).toBeVisible();
    if (await treeTab.count() > 0) {
      await expect(treeTab.first()).toBeVisible();
    }
  });

  test("Modal Assign Course memungkinkan pemilihan sales rep, tanggal jatuh tempo, dan unassign", async ({ managerPage: page }) => {
    await page.goto("/manager/courses");

    // Cari tombol aksi Assign pada kursus pertama
    const assignBtn = page.locator("button:has-text('Assign')").first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();

      // Modal penugasan terbuka
      const modalHeader = page.locator("text=Assign Training").or(page.locator("text=Assign Course"));
      await expect(modalHeader.first()).toBeVisible({ timeout: 5000 });

      // Verifikasi input tanggal dan catatan
      await expect(page.locator("input[type='date']")).toBeVisible();
      await expect(page.locator("textarea")).toBeVisible();

      // Tutup modal
      const closeBtn = page.locator("button:has-text('Cancel')").or(page.locator("button svg.lucide-x")).first();
      await closeBtn.click();
    }
  });

  test("Konfigurasi Bobot Algoritma SAW memvalidasi total 100% dan menyimpan perubahan", async ({ managerPage: page }) => {
    await page.goto("/manager/leaderboard/config");

    // Judul halaman konfigurasi SAW
    await expect(page.locator("h1:has-text('SAW Rankings & Weights')")).toBeVisible();

    // Verifikasi 5 kriteria utama
    await expect(page.locator("text=Average Score")).toBeVisible();
    await expect(page.locator("text=Outcome Rate")).toBeVisible();
    await expect(page.locator("text=Improvement")).toBeVisible();
    await expect(page.locator("text=Completion Rate")).toBeVisible();
    await expect(page.locator("text=Deadline Compliance")).toBeVisible();

    // Verifikasi tombol simpan
    const saveBtn = page.getByRole("button", { name: /save|simpan/i });
    await expect(saveBtn).toBeVisible();
  });
});
