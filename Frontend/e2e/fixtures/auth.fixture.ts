import { test as base, Page } from "@playwright/test";

export type RoleType = "super_admin" | "company_admin" | "manager" | "karyawan";

export const DEMO_CREDENTIALS: Record<RoleType, { email: string; name: string; targetUrl: string }> = {
  super_admin: {
    email: "superadmin@salescoach.ai",
    name: "System Super Admin",
    targetUrl: "/admin/strategic",
  },
  company_admin: {
    email: "admin@indofood.co.id",
    name: "Admin Indofood",
    targetUrl: "/admin/dashboard",
  },
  manager: {
    email: "mgr.indomie@indofood.co.id",
    name: "Manager Indomie",
    targetUrl: "/manager/dashboard",
  },
  karyawan: {
    email: "budi.sales1@indofood.co.id",
    name: "Budi Pratama (Sales)",
    targetUrl: "/karyawan/dashboard",
  },
};

export async function loginAsRole(page: Page, role: RoleType) {
  const creds = DEMO_CREDENTIALS[role];
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  // Buka dropdown akun demo
  const demoDropdownBtn = page.getByRole("button", { name: /pilih akun demo/i });
  await demoDropdownBtn.click();

  // Cari email atau nama di dropdown
  const searchInput = page.getByPlaceholder("Cari nama, email, perusahaan, atau tim...");
  if (await searchInput.isVisible()) {
    await searchInput.fill(creds.email);
  }

  // Klik tombol akun yang sesuai
  const accountBtn = page.locator(`button:has-text("${creds.email}")`).first();
  await accountBtn.click();

  // Tunggu navigasi ke URL dashboard spesifik per role
  await page.waitForURL(`**${creds.targetUrl}*`, { timeout: 15000 });
}

export const test = base.extend<{
  karyawanPage: Page;
  managerPage: Page;
  adminPage: Page;
  superAdminPage: Page;
}>({
  karyawanPage: async ({ page }, use) => {
    await loginAsRole(page, "karyawan");
    await use(page);
  },
  managerPage: async ({ page }, use) => {
    await loginAsRole(page, "manager");
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    await loginAsRole(page, "company_admin");
    await use(page);
  },
  superAdminPage: async ({ page }, use) => {
    await loginAsRole(page, "super_admin");
    await use(page);
  },
});

export { expect } from "@playwright/test";
