"use client";

import { useAuthStore } from "../../store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KaryawanSidebar } from "../../components/layout/KaryawanSidebar";
import { RoleGuard } from "../../components/layout/RoleGuard";
import { Header } from "../../components/layout/Header";

export default function KaryawanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!token || !user) {
      router.push("/login");
    } else if (user.role !== "karyawan") {
      const isSession = pathname?.includes("/karyawan/session/");
      if (!isSession) {
        router.push("/");
      }
    }
  }, [token, user, router, _hasHydrated, pathname]);

  if (!mounted || !_hasHydrated || !user || !token) return null;

  const isSessionPage = pathname?.includes("/karyawan/session/") && !pathname?.includes("/result");
  const isSessionResultPage = pathname?.includes("/karyawan/session/") && pathname?.includes("/result");

  if (isSessionPage) {
    return (
      <RoleGuard allowedRoles={["karyawan", "manager", "company_admin", "super_admin"]} userRole={user.role}>
        <div className="h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
          <main className="h-full w-full overflow-hidden">
            {children}
          </main>
        </div>
      </RoleGuard>
    );
  }

  if (isSessionResultPage) {
    return (
      <RoleGuard allowedRoles={["karyawan", "manager", "company_admin", "super_admin"]} userRole={user.role}>
        <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
          {user.role === "karyawan" ? <KaryawanSidebar /> : null}
          <main className="flex-1 overflow-y-auto animate-fade-in">
            <Header />
            {children}
          </main>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["karyawan"]} userRole={user.role}>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
        <KaryawanSidebar />
        <main className="flex-1 overflow-y-auto animate-fade-in">
          <Header />
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
