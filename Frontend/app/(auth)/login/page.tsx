"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState, useEffect, Fragment, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getDashboardPath } from "../../../store/authStore";
import type { Role } from "../../../store/authStore";
import { apiClient } from "../../../lib/api/client";
import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  Building2,
  Users,
  UserCircle,
  User,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Exclude<Role, null>;
    companyId?: string | null;
  };
};

type DemoAccount = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, null>;
  company?: { name: string } | null;
  team?: { name: string } | null;
};

type ShortcutRole = "all" | "super_admin" | "company_admin" | "manager" | "karyawan";

const SHORTCUT_ROLES: { id: ShortcutRole; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "super_admin", label: "Super Admin" },
  { id: "company_admin", label: "HR / Admin" },
  { id: "manager", label: "Manager" },
  { id: "karyawan", label: "Sales" },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoAccount[]>([
    { id: "1", name: "System Super Admin", email: "superadmin@salescoach.ai", role: "super_admin", company: null, team: null },
    { id: "2", name: "Admin Indofood", email: "admin@indofood.co.id", role: "company_admin", company: { name: "PT Indofood Sukses Makmur Tbk" }, team: null },
    { id: "3", name: "Manager Indomie", email: "mgr.indomie@indofood.co.id", role: "manager", company: { name: "PT Indofood Sukses Makmur Tbk" }, team: { name: "Indomie Division" } },
    { id: "4", name: "Budi Pratama (Sales)", email: "budi.sales1@indofood.co.id", role: "karyawan", company: { name: "PT Indofood Sukses Makmur Tbk" }, team: { name: "Indomie Division" } },
    { id: "5", name: "Manager Bogasari", email: "mgr.bogasari@indofood.co.id", role: "manager", company: { name: "PT Indofood Sukses Makmur Tbk" }, team: { name: "Bogasari Division" } },
    { id: "6", name: "Siti Wijaya (Sales)", email: "siti.sales2@indofood.co.id", role: "karyawan", company: { name: "PT Indofood Sukses Makmur Tbk" }, team: { name: "Bogasari Division" } },
    { id: "7", name: "Admin Djarum", email: "admin@djarum.com", role: "company_admin", company: { name: "PT Djarum" }, team: null },
    { id: "8", name: "Manager Polytron", email: "mgr.electronics@djarum.com", role: "manager", company: { name: "PT Djarum" }, team: { name: "Polytron Electronics" } },
    { id: "9", name: "Kevin Sanjaya (Sales)", email: "kevin.sales1@djarum.com", role: "karyawan", company: { name: "PT Djarum" }, team: { name: "Polytron Electronics" } },
    { id: "10", name: "HR / Admin Indotrack", email: "hr@indotrack.co.id", role: "company_admin", company: { name: "PT Indotrack Alat Berat" }, team: null },
    { id: "11", name: "Budi Pratama (Manager)", email: "budi1@indotrack.co.id", role: "manager", company: { name: "PT Indotrack Alat Berat" }, team: { name: "Heavy Fleet Sales Team" } },
    { id: "12", name: "Raka Kusuma (Sales)", email: "raka.sales@indotrack.co.id", role: "karyawan", company: { name: "PT Indotrack Alat Berat" }, team: { name: "Heavy Fleet Sales Team" } },
    { id: "13", name: "HR / Admin Medika", email: "hr@medikasakti.co.id", role: "company_admin", company: { name: "PT Medika Persada Sakti" }, team: null },
    { id: "14", name: "Dedi Prabowo (Manager)", email: "dedi90@medikasakti.co.id", role: "manager", company: { name: "PT Medika Persada Sakti" }, team: { name: "Hospital Equipment Team" } },
    { id: "15", name: "Nadia Firmansyah (Sales)", email: "nadia.sales@medikasakti.co.id", role: "karyawan", company: { name: "PT Medika Persada Sakti" }, team: { name: "Hospital Equipment Team" } },
  ]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [shortcutRole, setShortcutRole] = useState<ShortcutRole>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    setDropdownSearch("");
  };

  useEffect(() => {
    apiClient.get("/auth/demo-users").then((res) => {
      const users = (res as { data?: DemoAccount[] } | null)?.data;
      if (users?.length) setDemoUsers(users);
    }).catch(console.error);

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShortcutLogin = async (userEmail: string) => {
    setError("");
    setLoading(true);
    try {
      const data = (await apiClient.post("/auth/demo-login", {
        email: userEmail,
      })) as LoginResponse;
      setAuth(data.token, data.user);
      router.push(getDashboardPath(data.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err, "Terjadi kesalahan.") : "Shortcut login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = (await apiClient.post("/auth/login", {
        email,
        password,
      })) as LoginResponse;
      setAuth(data.token, data.user);
      router.push(getDashboardPath(data.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err, "Terjadi kesalahan.") : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Filter helper - match name OR email, case-insensitive
  const matchesSearch = useCallback(
    (u: DemoAccount) => {
      if (!dropdownSearch.trim()) return true;
      const q = dropdownSearch.toLowerCase();
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.company?.name || "").toLowerCase().includes(q) ||
        (u.team?.name || "").toLowerCase().includes(q)
      );
    },
    [dropdownSearch],
  );

  const matchesRole = (u: DemoAccount) => shortcutRole === "all" || u.role === shortcutRole;
  const superAdmins = demoUsers.filter(
    (u) => u.role === "super_admin" && matchesSearch(u) && matchesRole(u),
  );
  const otherUsers = demoUsers.filter(
    (u) => u.role !== "super_admin" && matchesSearch(u) && matchesRole(u),
  );

  // Group by company name for all demo users
  const companies = otherUsers.reduce<Record<string, DemoAccount[]>>((acc, user) => {
    const companyName = user.company?.name || "General Companies";
    (acc[companyName] ??= []).push(user);
    return acc;
  }, {});

  const totalVisible =
    superAdmins.length +
    Object.values(companies).reduce((s, arr) => s + arr.length, 0);

  const openDropdown = () => {
    setIsDropdownOpen(true);
    // auto-focus search after paint
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDropdown();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isDropdownOpen]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--color-surface)] p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/login-ai-hub-hd.webp')] bg-cover bg-center"
      />
      <div className="absolute inset-0 bg-black/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(74,156,247,0.24),transparent_34%),linear-gradient(120deg,rgba(8,12,18,0.72),rgba(8,12,18,0.28)_52%,rgba(8,12,18,0.68))]" />

      <div className="relative z-10 w-full max-w-[1060px] bg-[var(--color-bg)]/48 backdrop-blur-2xl rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/15 h-auto md:min-h-[580px]">
        {/* Left Side - Visual */}
        <div className="hidden md:block md:w-1/2 p-3">
          <div className="w-full h-full border border-white/15 rounded-[1.5rem] relative overflow-hidden flex flex-col justify-between p-8 bg-black/24">
            <div className="absolute inset-0 bg-[url('/login-ai-hub-hd.webp')] bg-cover bg-center opacity-95" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/58 via-black/10 to-black/62" />
            <h1 className="relative z-10 text-3xl font-semibold text-white leading-[1.2] tracking-tight max-w-sm drop-shadow-lg">
              Master sales conversations before meeting real clients.
            </h1>

            <div className="relative z-10 max-w-[280px] rounded-2xl border border-white/15 bg-white/12 p-4 text-sm font-medium leading-6 text-white/88 backdrop-blur-md">
              Practice with AI clients, review your responses, and sharpen every
              closing strategy.
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-[var(--color-bg)]/62 backdrop-blur-xl">
          <div className="w-full max-w-[340px] mx-auto">
            {/* Logo */}
            <div className="mb-4">
              <Image
                src="/m-logo.png"
                alt="MAXY Academy"
                width={64}
                height={64}
                className="h-10 w-10 overflow-hidden rounded-2xl object-contain shadow-sm"
                priority
              />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] mb-1">
              Welcome Back
            </h2>
            <p className="text-sm font-medium text-[var(--color-text-muted)] mb-5">
              Return to your AI sales training workspace.
            </p>

            <hr className="border-white/12 mb-5" />

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/12 border border-red-400/30 text-red-200 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-semibold text-[var(--color-text-muted)]"
                  htmlFor="email"
                >
                  Your email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="w-full px-3.5 py-2.5 bg-[var(--color-bg)]/62 border border-white/12 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all text-sm font-medium shadow-sm backdrop-blur-md"
                  placeholder="hi@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-semibold text-[var(--color-text-muted)]"
                  htmlFor="password"
                >
                  Your password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  className="w-full px-3.5 py-2.5 bg-[var(--color-bg)]/62 border border-white/12 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all text-sm font-medium shadow-sm backdrop-blur-md"
                  placeholder="**********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/12">
              <div className="mb-3 text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">Masuk dengan akun demo</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Pilih peran, lalu pilih akun dari perusahaan atau tim.</p>
              </div>

              <div className="mt-4 relative" ref={dropdownRef}>
                <button
                  type="button"
                  aria-expanded={isDropdownOpen}
                  aria-controls="shortcut-account-panel"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDropdownOpen) closeDropdown();
                    else openDropdown();
                  }}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-bg)]/62 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all text-sm font-medium shadow-sm text-[var(--color-text)] flex justify-between items-center backdrop-blur-md"
                >
                  <span className="text-left">Pilih akun demo</span>
                  <ChevronDown
                    className={`w-4 h-4 opacity-70 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isDropdownOpen && (
                  <div id="shortcut-account-panel" className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-white/15 rounded-xl shadow-2xl overflow-hidden z-[100] flex flex-col max-h-[min(72vh,520px)]">
                    {/* ── Search Input ── */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8 bg-slate-800/60 shrink-0">
                      <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        aria-label="Cari akun berdasarkan nama, email, perusahaan, atau tim"
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Cari nama, email, perusahaan, atau tim..."
                        className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
                      />
                      {dropdownSearch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownSearch("");
                            searchInputRef.current?.focus();
                          }}
                          className="text-gray-400 hover:text-gray-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div role="group" aria-label="Filter akun berdasarkan peran" className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2 border-b border-white/10 shrink-0">
                      {SHORTCUT_ROLES.map(({ id, label }) => {
                        const count = demoUsers.filter((user) => id === "all" || user.role === id).length;
                        const selected = shortcutRole === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setShortcutRole(id)}
                            className={`min-h-10 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-300 ${selected ? "border-sky-400 bg-sky-400/15 text-sky-100" : "border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                          >
                            {label} <span className="ml-1 opacity-75">{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── List ── */}
                    <div className="overflow-y-auto custom-scrollbar flex flex-col py-1.5" aria-label="Daftar akun demo">
                      {demoUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">
                          Belum ada akun tersedia.
                        </div>
                      ) : totalVisible === 0 ? (
                        <div className="px-4 py-5 text-sm text-gray-400 text-center">
                          <Search className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                          Tidak ada akun yang cocok.
                        </div>
                      ) : (
                        <>
                          {superAdmins.length > 0 && (
                            <section className="flex flex-col" aria-label="Akun Super Admin">
                              <div className="px-3 py-2 text-xs font-semibold text-amber-200 bg-slate-800 border-b border-white/10">
                                Super Admin <span className="ml-1 text-slate-400">· {superAdmins.length} akun</span>
                              </div>
                              {superAdmins.map((u: DemoAccount) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeDropdown();
                                    handleShortcutLogin(u.email);
                                  }}
                                  aria-label={`Super Admin: ${u.name}, ${u.email}`}
                                  className="min-h-14 px-3 py-2 text-sm text-gray-200 hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300 transition-colors flex items-center gap-3 text-left"
                                >
                                  <Crown className="w-4 h-4 text-yellow-500 shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate font-medium">
                                      {u.name}
                                    </span>
                                    <span className="truncate text-[10px] text-gray-400">
                                      {u.email}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </section>
                          )}

                          {Object.entries(companies).map(
                            ([companyName, cUsers]) => {
                              const admins = cUsers.filter(
                                (u) => u.role === "company_admin",
                              );
                              const byTeam = cUsers
                                .filter((u) => u.role !== "company_admin")
                                .reduce<Record<string, DemoAccount[]>>(
                                  (acc, u) => {
                                    const tName = u.team?.name || "No Team";
                                    (acc[tName] ??= []).push(u);
                                    return acc;
                                  },
                                  {},
                                );

                              return (
                                <section
                                  key={companyName}
                                  aria-label={`Perusahaan ${companyName}`}
                                  className="flex flex-col"
                                >
                                  <div className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 border-y border-white/10">
                                    {companyName} <span className="ml-1 text-slate-400">· {cUsers.length} akun</span>
                                  </div>

                                  {admins.length > 0 && <div className="px-3 py-1.5 text-[11px] font-semibold text-sky-200 bg-slate-900/80">HR / Admin perusahaan</div>}
                                  {admins.map((u) => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        closeDropdown();
                                        handleShortcutLogin(u.email);
                                      }}
                                      aria-label={`HR atau Admin perusahaan: ${u.name}, ${companyName}, ${u.email}`}
                                      className="min-h-14 px-3 py-2 pl-4 text-sm text-gray-200 hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300 transition-colors flex items-center gap-3 text-left"
                                    >
                                      <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate font-medium">
                                          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300">HR / Admin</span>
                                          {u.name}
                                        </span>
                                        <span className="truncate text-[10px] text-gray-400">
                                          {u.email}
                                        </span>
                                      </div>
                                    </button>
                                  ))}

                                  {Object.entries(byTeam).map(
                                    ([tName, tUsers]: [string, DemoAccount[]]) => (
                                      <Fragment key={tName}>
                                        <div className="px-3 py-1.5 pl-6 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mt-1 bg-slate-800/50">
                                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                                          <span>{tName === "No Team" ? "Tanpa tim" : `Tim · ${tName.replace(/^Tim\s+/i, "")}`}</span>
                                        </div>

                                        {tUsers
                                          .filter((u) => u.role === "manager")
                                          .map((u) => (
                                            <button
                                              key={u.id}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                closeDropdown();
                                                handleShortcutLogin(u.email);
                                              }}
                                              aria-label={`Manager: ${u.name}, ${companyName}, tim ${tName === "No Team" ? "belum ditentukan" : tName}, ${u.email}`}
                                              className="min-h-14 px-3 py-2 pl-8 text-sm text-gray-200 hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300 transition-colors flex items-center gap-3 text-left"
                                            >
                                              <UserCircle className="w-4 h-4 text-green-400 shrink-0" />
                                              <div className="flex flex-col min-w-0">
                                                <span className="truncate font-medium">
                                                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Manager</span>
                                                  {u.name}
                                                </span>
                                                <span className="truncate text-[10px] text-gray-400">
                                                  {u.email}
                                                </span>
                                              </div>
                                            </button>
                                          ))}

                                        {tUsers
                                          .filter((u) => u.role === "karyawan")
                                          .map((u) => (
                                            <button
                                              key={u.id}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                closeDropdown();
                                                handleShortcutLogin(u.email);
                                              }}
                                              aria-label={`Sales: ${u.name}, ${companyName}, tim ${tName === "No Team" ? "belum ditentukan" : tName}, ${u.email}`}
                                              className="min-h-14 px-3 py-2 pl-10 text-sm text-gray-200 hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-300 transition-colors flex items-center gap-3 text-left"
                                            >
                                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                                              <div className="flex flex-col min-w-0">
                                                <span className="truncate font-medium">
                                                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sales</span>
                                                  {u.name}
                                                </span>
                                                <span className="truncate text-[10px] text-gray-400">
                                                  {u.email}
                                                </span>
                                              </div>
                                            </button>
                                          ))}
                                      </Fragment>
                                    ),
                                  )}
                                </section>
                              );
                            },
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 text-center text-sm font-medium text-[var(--color-text-muted)]">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="text-[var(--color-text)] underline decoration-2 decoration-[var(--color-text-muted)] underline-offset-4 hover:decoration-[var(--color-text)] transition-colors"
              >
                Daftar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}