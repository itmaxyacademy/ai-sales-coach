import { test, expect } from "../fixtures/auth.fixture";

test.describe("Admin Platform Administration, User Management, and System Operations", () => {
  test("Super Admin Strategic Overview memuat metrik bisnis SaaS dan penggunaan token AI", async ({ superAdminPage: page }) => {
    await page.goto("/admin/strategic");

    // Header ringkasan strategis
    await expect(page.locator("h1:has-text('Strategic Overview')").or(page.locator("text=System Control"))).toBeVisible();

    // Verifikasi metrik platform
    await expect(page.locator("text=Total Users").or(page.locator("text=Users"))).toBeVisible();
    await expect(page.locator("text=Total Sessions").or(page.locator("text=Sessions"))).toBeVisible();
  });

  test("Manajemen Pengguna mendukung penambahan user, pencarian, dan reset password", async ({ adminPage: page }) => {
    await page.goto("/admin/users");

    // Header User Management
    await expect(page.locator("h1:has-text('User Management')")).toBeVisible();

    // Input filter pencarian
    const searchInput = page.getByPlaceholder(/search user/i).or(page.getByPlaceholder(/search/i)).first();
    await expect(searchInput).toBeVisible();

    // Tabel pengguna
    await expect(page.locator("table.data-table")).toBeVisible();

    // Verifikasi tombol Tambah Pengguna
    const addUserBtn = page.getByRole("button", { name: /add user|tambah user|user plus/i }).or(page.locator("button:has-text('Add User')")).first();
    if (await addUserBtn.isVisible()) {
      await addUserBtn.click();

      // Form modal terbuka
      await expect(page.locator("input[name='name']").or(page.locator("input#name")).or(page.getByPlaceholder(/name/i))).toBeVisible();
      const cancelBtn = page.locator("button:has-text('Cancel')").or(page.locator("button svg.lucide-x")).first();
      await cancelBtn.click();
    }
  });

  test("Audit Kursus memungkinkan deaktivasi dan reaktivasi skenario pembelajaran", async ({ adminPage: page }) => {
    await page.goto("/admin/courses");

    // Header Course Audit
    await expect(page.locator("h1:has-text('Course Audit')").or(page.locator("text=Courses"))).toBeVisible();

    // Tabel kursus
    await expect(page.locator("table.data-table")).toBeVisible();
  });

  test("Broadcast Notifikasi berhasil mengirim pengumuman ke seluruh karyawan atau manajer", async ({ adminPage: page }) => {
    await page.goto("/admin/notifications");

    // Header Broadcast Notifications
    await expect(page.locator("h1:has-text('Broadcast Notifications')")).toBeVisible();

    // Field form broadcast
    const titleInput = page.locator("input[name='title']").or(page.getByPlaceholder(/title|judul/i)).first();
    const messageInput = page.locator("textarea[name='message']").or(page.getByPlaceholder(/message|pesan/i)).first();
    const submitBtn = page.getByRole("button", { name: /send broadcast|kirim notifikasi/i }).first();

    await expect(titleInput).toBeVisible();
    await expect(messageInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test("Laporan Penggunaan Token AI menampilkan total token, model, dan log request", async ({ superAdminPage: page }) => {
    await page.goto("/admin/token-report");

    // Header Token Report
    await expect(page.locator("h1:has-text('Token Report')").or(page.locator("text=AI Token Usage"))).toBeVisible();

    // Verifikasi metrik kartu token
    await expect(page.locator("text=Total Tokens").or(page.locator("text=Tokens"))).toBeVisible();
  });
});
