"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore, getDashboardPath } from "../../../store/authStore";
import Image from "next/image";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [role, setRole] = useState("company_admin");
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("role");
      if (r) setRole(r);
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (role === "company_admin") {
        const payload: any = { companyName, adminName, adminEmail, adminPassword };
        const data = await apiClient.post("/auth/register-company", payload);
        setAuth(data.token, data.user);
        router.push("/onboarding");
      } else {
        const payload: any = { name: adminName, email: adminEmail, password: adminPassword, role };
        const data = await apiClient.post("/auth/register", payload);
        setAuth(data.token, data.user);
        router.push(getDashboardPath(data.user.role));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplay = () => {
    switch(role) {
      case "super_admin": return "Super Admin";
      case "company_admin": return "Company Admin";
      case "manager": return "Manager";
      case "karyawan": return "Karyawan";
      default: return "Account";
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--color-surface)] p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/login-ai-hub-hd.webp')] bg-cover bg-center"
      />
      <div className="absolute inset-0 bg-black/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(74,156,247,0.24),transparent_34%),linear-gradient(120deg,rgba(8,12,18,0.72),rgba(8,12,18,0.28)_52%,rgba(8,12,18,0.68))]" />

      <div className="relative z-10 w-full max-w-[1060px] bg-[var(--color-bg)]/48 backdrop-blur-2xl rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/15 h-auto md:min-h-[580px]">
        <div className="hidden md:block md:w-1/2 p-3">
          <div className="w-full h-full border border-white/15 rounded-[1.5rem] relative overflow-hidden flex flex-col justify-between p-8 bg-black/24">
            <div className="absolute inset-0 bg-[url('/login-ai-hub-hd.webp')] bg-cover bg-center opacity-95" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/58 via-black/10 to-black/62" />
            <h1 className="relative z-10 text-3xl font-semibold text-white leading-[1.2] tracking-tight max-w-sm drop-shadow-lg">
              Start your sales training journey with AI guidance.
            </h1>

            <div className="relative z-10 max-w-[280px] rounded-2xl border border-white/15 bg-white/12 p-4 text-sm font-medium leading-6 text-white/88 backdrop-blur-md">
              Create your workspace, choose a scenario, and grow from every roleplay session.
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-[var(--color-bg)]/62 backdrop-blur-xl">
          <div className="w-full max-w-[360px] mx-auto">
            <div className="mb-5">
              <Image
                src="/m-logo.png"
                alt="MAXY Academy"
                width={64}
                height={64}
                className="h-10 w-10 overflow-hidden rounded-2xl object-contain shadow-sm"
                priority
              />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] mb-1">Buat Akun {getRoleDisplay()}</h2>
            <p className="text-sm font-medium text-[var(--color-text-muted)] mb-5">Set up your account and begin practicing smarter sales conversations.</p>
            
            <hr className="border-white/12 mb-5" />

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/12 border border-red-400/30 text-red-200 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className={`grid ${role === 'company_admin' ? 'grid-cols-2 gap-4' : 'grid-cols-1 gap-4'}`}>
                {role === "company_admin" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="companyName">Company Name</label>
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent text-sm text-white placeholder-white/40 transition-all outline-none"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="adminName">Your Full Name</label>
                  <input
                    id="adminName"
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent text-sm text-white placeholder-white/40 transition-all outline-none"
                    placeholder="e.g. Jane Doe"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="adminEmail">Work Email</label>
                <input
                  id="adminEmail"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent text-sm text-white placeholder-white/40 transition-all outline-none"
                  placeholder="jane@acmecorp.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="adminPassword">Password</label>
                <input
                  id="adminPassword"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent text-sm text-white placeholder-white/40 transition-all outline-none"
                  placeholder="••••••••"
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[var(--color-accent)] hover:brightness-110 text-white font-semibold rounded-xl transition-all disabled:opacity-50 mt-6 flex justify-center items-center shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Create account and start training"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm font-medium text-[var(--color-text-muted)]">
              Already have account?{' '}
              <Link href="/login" className="text-[var(--color-text)] underline decoration-2 decoration-[var(--color-text-muted)] underline-offset-4 hover:decoration-[var(--color-text)] transition-colors">
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}