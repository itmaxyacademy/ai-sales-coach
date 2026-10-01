"use client";

import { useAuthStore } from "../../store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ManagerSidebar } from "../../components/layout/ManagerSidebar";
import { RoleGuard } from "../../components/layout/RoleGuard";
import { Header } from "../../components/layout/Header";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!_hasHydrated) return;

    if (!token || !user) {
      router.push("/login");
    } else if (
      user.role !== "manager" &&
      user.role !== "company_admin" &&
      user.role !== "super_admin"
    ) {
      router.push("/");
    }
  }, [token, user, router, _hasHydrated]);

  if (!mounted || !_hasHydrated || !user || !token) return null;

  return (
    <RoleGuard allowedRoles={["manager", "company_admin", "super_admin"]} userRole={user.role}>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
        <ManagerSidebar />
        <main className="flex-1 overflow-y-auto animate-fade-in">
          <Header />
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}