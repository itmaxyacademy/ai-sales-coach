"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ClipboardCheck,
  Star,
  Clock,
  Megaphone,
  UserCircle2,
  LogOut,
  Palette,
  Search,
  Command,
} from "lucide-react";
import { apiClient } from "../../lib/api/client";
import { useAuthStore } from "../../store/authStore";
import { useSidebarStore } from "../../store/sidebarStore";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface SearchItem {
  title: string;
  href: string;
  type: "Page" | "Setting" | "Action" | "Recent";
}

export function Header() {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useSidebarStore();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  // --- Search State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Role display label
  const roleLabel =
    user?.role === "karyawan"
      ? "Sales Rep"
      : user?.role === "super_admin"
      ? "Super Admin"
      : user?.role === "company_admin"
      ? "Company Admin"
      : user?.role === "manager"
      ? "Team Leader"
      : user?.role || "User";

  // Role color
  const roleColor =
    user?.role === "super_admin"
      ? "bg-[var(--color-purple-light)] text-[var(--color-purple)]"
      : user?.role === "company_admin"
      ? "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
      : user?.role === "manager"
      ? "bg-[var(--color-purple-light)] text-[var(--color-purple)]"
      : "bg-[var(--color-accent-light)] text-[var(--color-accent)]";

  // Avatar bg
  const avatarBg =
    user?.role === "super_admin" || user?.role === "manager" || user?.role === "company_admin"
      ? "var(--color-purple)"
      : "var(--color-accent)";

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const profileHref =
    user?.role === "karyawan"
      ? "/karyawan/me"
      : user?.role === "manager" || user?.role === "company_admin"
      ? "/manager/me"
      : user?.role === "super_admin"
      ? "/admin/me"
      : undefined;

  // Fetch Recent Sessions for Global Search
  useEffect(() => {
    if (user?.role === "karyawan") {
      apiClient.get("/sessions/history?limit=3")
        .then(res => { if (res?.sessions) setRecentSessions(res.sessions); })
        .catch(() => {});
    } else if (user?.role === "manager") {
      apiClient.get("/manager/sessions?limit=3&sort=latest")
        .then(res => { 
          const sessions = res?.sessions || res?.data || [];
          setRecentSessions(sessions); 
        })
        .catch(() => {});
    }
  }, [user?.role]);

  // --- Dynamic Search Index (100% Mapping dari Semua Sidebar) ---
  const getSearchIndex = (): SearchItem[] => {
    const index: SearchItem[] = [];
    
    // ===============================
    // 1. MENU KARYAWAN
    // ===============================
    if (user?.role === "karyawan") {
      index.push(
        { title: "Dashboard", href: "/karyawan/dashboard", type: "Page" },
        { title: "My Assignments", href: "/karyawan/assignments", type: "Page" },
        { title: "Start Roleplay", href: "/karyawan/courses", type: "Page" },
        { title: "My Performance", href: "/karyawan/history", type: "Page" },
        { title: "Skill Progress", href: "/karyawan/progress", type: "Page" },
        { title: "My Badges", href: "/karyawan/badges", type: "Page" },
        { title: "My Ranking", href: "/karyawan/leaderboard", type: "Page" }
      );
      
      // Dynamic Recent Sessions
      recentSessions.forEach(s => {
        index.push({
          title: `Recent: ${s.course?.title || "Roleplay"}`,
          href: `/karyawan/session/${s.id}`,
          type: "Recent"
        });
      });
    } 
    // ===============================
    // 2. MENU MANAGER
    // ===============================
    else if (user?.role === "manager") {
      index.push(
        { title: "Team Dashboard", href: "/manager/dashboard", type: "Page" },
        { title: "My Team", href: "/manager/team", type: "Page" },
        { title: "Courses", href: "/manager/courses", type: "Page" },
        { title: "Sessions", href: "/manager/sessions", type: "Page" },
        { title: "Team Analytics", href: "/manager/analytics", type: "Page" },
        { title: "SAW Rankings & Weights", href: "/manager/leaderboard/config", type: "Setting" }
      );

      // Dynamic Recent Team Sessions
      recentSessions.forEach(s => {
        index.push({
          title: `Team Session: ${s.course?.title || "Roleplay"} (${s.userName || "User"})`,
          href: `/manager/sessions/${s.id}`,
          type: "Recent"
        });
      });
    } 
    // ===============================
    // 3. MENU SUPER ADMIN
    // ===============================
    else if (user?.role === "super_admin") {
      index.push(
        { title: "Strategic Overview", href: "/admin/strategic", type: "Page" },
        { title: "System Control", href: "/admin/dashboard", type: "Page" },
        { title: "User Management", href: "/admin/users", type: "Page" },
        { title: "Courses", href: "/admin/courses", type: "Page" },
        { title: "Sessions", href: "/admin/sessions", type: "Page" },
        { title: "Notifications", href: "/admin/notifications", type: "Page" },
        { title: "AI Knowledge Base", href: "/admin/ai-context", type: "Setting" }
      );
    }
    // ===============================
    // 4. MENU COMPANY ADMIN
    // ===============================
    else if (user?.role === "company_admin") {
      index.push(
        { title: "Company Dashboard", href: "/admin/dashboard", type: "Page" },
        { title: "User Management", href: "/admin/users", type: "Page" },
        { title: "Team Management", href: "/admin/teams", type: "Page" },
        { title: "Courses", href: "/admin/courses", type: "Page" },
        { title: "Sessions", href: "/admin/sessions", type: "Page" },
        { title: "Notifications", href: "/admin/notifications", type: "Page" },
        { title: "AI Knowledge Base", href: "/admin/ai-context", type: "Setting" }
      );
    }

    // ===============================
    // 5. MENU UMUM (FOOTER SIDEBAR)
    // ===============================
    if (profileHref) {
      index.push({ title: "My Profile", href: profileHref, type: "Page" });
    }
    index.push({ title: "Appearance Settings", href: "/settings/preference", type: "Setting" });
    
    // Menambahkan aksi Sign Out ke dalam Command Palette
    index.push({ title: "Sign Out", href: "#signout", type: "Action" });

    return index;
  };

  const searchIndex = getSearchIndex();
  const filteredResults = searchQuery
    ? searchIndex.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchIndex.slice(0, 15); // Tampilkan 15 menu rekomendasi jika bar kosong (semua termuat)

  // --- Keyboard Shortcut Logic ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tombol Ctrl+K atau Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get("/notifications/unread-count");
      if (res && typeof res.count === "number") setUnreadCount(res.count);
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get("/notifications");
      if (res && Array.isArray(res.data)) setNotifications(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen]);

  // Click Outside Handlers
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "assignment":
        return <ClipboardCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />;
      case "rank_up":
        return <Star className="w-3.5 h-3.5 text-amber-500" />;
      case "reminder":
        return <Clock className="w-3.5 h-3.5 text-[var(--color-purple)]" />;
      case "broadcast":
      case "system":
        return <Megaphone className="w-3.5 h-3.5 text-[var(--color-danger)]" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />;
    }
  };

  return (
    <header className="app-header flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Left: Hamburger (Mobile) */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-1.5 -ml-2 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition-colors"
          onClick={toggleSidebar}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ─── Global Search Bar ─── */}
      <div className="flex-1 max-w-xl px-4 hidden md:block" ref={searchRef}>
        <div className="relative group">
          <div className={`flex items-center w-full px-3 py-1.5 bg-[var(--color-bg)] border transition-colors rounded-xl ${
            isSearchOpen ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20" : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
          }`}>
            <Search className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search menus, features, and recent sessions..."
              className="w-full bg-transparent border-none outline-none px-2 text-xs text-[var(--color-text)] placeholder-[var(--color-text-subtle)]"
            />
            <div className="hidden lg:flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[9px] text-[var(--color-text-subtle)] font-medium">
              <Command className="w-2.5 h-2.5" /> K
            </div>
          </div>

          {/* Search Results Dropdown (Scrollable) */}
          {isSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {filteredResults.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <p className="px-2 py-1.5 text-[10px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider">
                      {searchQuery ? "Search Results" : "Suggestions"}
                    </p>
                    {filteredResults.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (item.href === "#signout") {
                            logout();
                            router.push("/login");
                          } else {
                            router.push(item.href);
                          }
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center justify-between w-full px-2 py-2 text-left rounded-lg hover:bg-[var(--color-bg)] transition-colors focus:outline-none focus:bg-[var(--color-bg)] group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center group-hover:border-[var(--color-accent)]/50 transition-colors">
                            {item.type === "Action" ? (
                               <LogOut className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-danger)]" />
                            ) : item.type === "Recent" ? (
                               <Clock className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                            ) : (
                               <Search className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                            )}
                          </div>
                          <span className={`text-xs font-medium transition-colors ${
                            item.type === "Action" ? "text-[var(--color-text)] group-hover:text-[var(--color-danger)]" : "text-[var(--color-text)] group-hover:text-[var(--color-accent)]"
                          }`}>
                            {item.title}
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-subtle)]">
                          {item.type}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Search className="w-6 h-6 mx-auto mb-2 text-[var(--color-text-subtle)] opacity-50" />
                    <p className="text-xs text-[var(--color-text-muted)]">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Notification + Profile */}
      <div className="flex items-center gap-1.5">

        {/* Mobile Search Icon */}
        <button 
          className="md:hidden w-8 h-8 rounded-lg hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] transition-all"
          onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* ─── Notification Bell ─── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); setIsSearchOpen(false); }}
            className="relative w-8 h-8 rounded-lg hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all border border-transparent hover:border-[var(--color-border)] focus:outline-none"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--color-danger)] text-[var(--color-bg)] text-[9px] font-bold rounded-full flex items-center justify-center border border-[var(--color-surface)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="font-semibold text-xs text-[var(--color-text)] flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-danger-light)] text-[var(--color-danger)] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-medium text-[var(--color-accent)] hover:underline focus:outline-none"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-7 h-7 mx-auto mb-2 text-[var(--color-text-subtle)]" />
                    <p className="text-xs text-[var(--color-text-muted)]">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 flex gap-2.5 relative group transition-colors hover:bg-[var(--color-bg)] ${
                        !n.isRead ? "bg-[var(--color-accent-light)]/20" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-bg)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-5">
                        <p
                          className={`text-xs truncate ${
                            !n.isRead
                              ? "font-semibold text-[var(--color-text)]"
                              : "font-medium text-[var(--color-text-muted)]"
                          }`}
                        >
                          {n.title}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[9px] text-[var(--color-text-subtle)] mt-1">
                          {new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="absolute right-2.5 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-success)] opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── User Info ─── */}
        <div className="hidden sm:flex items-center gap-2 mx-2">
          {user?.name && (
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {user.name}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleColor}`}>
            {roleLabel}
          </span>
        </div>

        {/* ─── Profile Icon ─── */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); setIsSearchOpen(false); }}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-[var(--color-bg)] border border-transparent hover:border-[var(--color-border)] transition-all focus:outline-none"
            title="Profile"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ background: avatarBg }}
            >
              {initials}
            </div>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text)] truncate">{user?.name}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{user?.email}</p>
              </div>
              
              <div className="p-1.5 space-y-0.5">
                {profileHref && (
                  <Link
                    href={profileHref}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <UserCircle2 className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    My Profile
                  </Link>
                )}

                <Link
                  href="/settings/preference"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <Palette className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  Appearance Settings
                </Link>
              </div>

              <div className="p-1.5 border-t border-[var(--color-border)]">
                <button
                  onClick={() => { logout(); router.push("/login"); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}