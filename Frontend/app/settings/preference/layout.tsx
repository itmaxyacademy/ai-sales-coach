"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSidebarStore } from "@/store/sidebarStore";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ManagerSidebar } from "@/components/layout/ManagerSidebar";
import { KaryawanSidebar } from "@/components/layout/KaryawanSidebar";
import { Header } from "@/components/layout/Header";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, token, _hasHydrated } = useAuthStore();
  const { isOpen } = useSidebarStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Proteksi Halaman: Jika belum login, tendang ke /login
  useEffect(() => {
    if (!mounted || !_hasHydrated) return;

    if (!token || !user) {
      router.push("/login");
    }
  }, [user, token, _hasHydrated, mounted, router]);

  if (!mounted || !_hasHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
      </div>
    );
  }

  // Jika user tidak sengaja mengakses tanpa auth sewaktu loading, return null sebelum redirect
  if (!token || !user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* 1. Sidebar Utama berdasarkan Role */}
      {user.role === "company_admin" || user.role === "super_admin" ? (
        <AdminSidebar />
      ) : user.role === "manager" ? (
        <ManagerSidebar />
      ) : (
        <KaryawanSidebar />
      )}
      {/* 2. Area Konten Kanan (Header + Page Content) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header/Navbar */}
        <Header />

        {/* Isi Halaman Page Settings Preference */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}