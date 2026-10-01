import { test, expect } from "@playwright/test";
import { loginAsRole, DEMO_CREDENTIALS, RoleType } from "../fixtures/auth.fixture";

test.describe("Authentication and Role-Based Redirection", () => {
  test("Menampilkan halaman login lengkap dengan form dan opsi akun demo", async ({ page }) => {
    await page.goto("/login");

    // Verifikasi judul dan deskripsi
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.locator("text=Return to your AI sales training workspace.")).toBeVisible();

    // Verifikasi field input
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();

    // Verifikasi dropdown akun demo
    const demoDropdown = page.getByRole("button", { name: /pilih akun demo/i });
    await expect(demoDropdown).toBeVisible();
  });

  const roles: RoleType[] = ["super_admin", "company_admin", "manager", "karyawan"];

  for (const role of roles) {
    test(`Login shortcut role [${role}] berhasil diarahkan ke dashboard ${DEMO_CREDENTIALS[role].targetUrl}`, async ({ page }) => {
      await loginAsRole(page, role);
      await expect(page).toHaveURL(new RegExp(DEMO_CREDENTIALS[role].targetUrl));

      // Verifikasi avatar user atau nama user di sidebar
      const sidebar = page.locator(".sidebar");
      await expect(sidebar).toBeVisible();
      await expect(sidebar.locator("button:has-text('Sign Out')")).toBeVisible();
    });
  }

  test("Role Guard mencegah karyawan mengakses halaman super admin", async ({ page }) => {
    // Login sebagai karyawan
    await loginAsRole(page, "karyawan");

    // Coba paksa akses rute super admin
    await page.goto("/admin/strategic");

    // Harus dicegat oleh RoleGuard
    const accessDeniedHeading = page.locator("text=Access Denied");
    const permissionNotice = page.locator("text=You do not have the required permissions");
    await expect(accessDeniedHeading.or(permissionNotice)).toBeVisible({ timeout: 5000 });
  });

  test("Logout mengembalikan sesi ke halaman login", async ({ page }) => {
    await loginAsRole(page, "karyawan");

    // Klik tombol sign out
    const signOutBtn = page.locator(".sidebar button:has-text('Sign Out')");
    await signOutBtn.click();

    // Pastikan kembali ke /login
    await page.waitForURL("**/login*", { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
