"use client";

import { useAuthStore } from "../../../store/authStore";
import SuperAdminDashboard from "../../../components/dashboard/SuperAdminDashboard";
import CompanyAdminDashboard from "../../../components/dashboard/CompanyAdminDashboard";

export default function DashboardSwitcher() {
  const { user } = useAuthStore();

  if (user?.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  if (user?.role === "company_admin") {
    return <CompanyAdminDashboard />;
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-[var(--color-text-muted)] text-sm">Loading dashboard...</p>
    </div>
  );
}
