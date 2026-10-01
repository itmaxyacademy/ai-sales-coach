"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  LogOut,
  ChevronRight,
  UserCircle,
  MessageSquare,
  Briefcase,
  ChevronDown,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
} from "lucide-react";
import { useSidebarStore } from "../../store/sidebarStore";

// Manager menu - operasional team
const navigation = [
  {
    section: "Organization",
    items: [
      { name: "Team Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
      { name: "My Team", href: "/manager/team", icon: Users },
    ],
  },
  {
    section: "Training",
    items: [
      { name: "Courses", href: "/manager/courses", icon: BookOpen },
      { name: "Sessions", href: "/manager/sessions", icon: Briefcase },
    ],
  },
  {
    section: "Analytics",
    items: [
      { name: "Team Analytics", href: "/manager/analytics", icon: BarChart3 },
      { name: "SAW Rankings & Weights", href: "/manager/leaderboard/config", icon: SlidersHorizontal },
    ],
  },
];

interface RecentSession {
  id: string;
  course?: { title: string };
  userName?: string;
  completedAt?: string;
}

export function ManagerSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isOpen } = useSidebarStore();
  const router = useRouter();
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    // Load recent team sessions
    apiClient
      .get("/manager/sessions?limit=5&sort=latest")
      .then((res) => {
        const sessions = res?.sessions || res?.data || [];
        setRecentSessions(sessions.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "M";

  return (
    <div className={`sidebar ${!isOpen ? "collapsed" : ""}`}>
      <div 
        className={`sidebar-logo flex w-full mb-4 relative transition-all duration-300 ${
          isOpen ? "flex-row items-center justify-between pr-2" : "flex-col items-center justify-center gap-4 py-2"
        }`}
      >
        <Link 
          href="/manager/dashboard" 
          className={`flex items-center overflow-hidden ${!isOpen ? "mx-auto" : ""}`}
        >
          <div 
            className={`flex items-center flex-shrink-0 transition-all duration-300 ${
              isOpen ? "justify-start h-10 p-0.5" : "justify-center w-10 h-10"
            }`}
          >
            <img 
              src="/m-logo.png" 
              alt="MAXY Academy" 
              className="sidebar-brand-logo h-full w-full rounded-xl object-contain" 
            />
          </div>
        </Link>
        
        <button
          onClick={useSidebarStore.getState().toggleSidebar}
          className={`w-7 h-7 rounded hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex-shrink-0 ${
            isOpen ? "ml-2" : "mx-auto"
          }`}
          title="Toggle Sidebar"
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navigation.map((group) => (
          <div key={group.section}>
            <span className="sidebar-section-label">{group.section}</span>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        {/* Recent Team Sessions */}
        {recentSessions.length > 0 && (
          <div className="mt-2">
            <details className="group">
              <summary 
                className="sidebar-item cursor-pointer"
                onClick={() => {
                  if (!useSidebarStore.getState().isOpen) {
                    useSidebarStore.getState().toggleSidebar();
                  }
                }}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="flex-1">Recent Team Conversations</span>
                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90 ml-auto" />
              </summary>
              <div className="mt-1 flex flex-col gap-1 ml-5 pl-3 border-l border-[var(--color-border)]">
                {recentSessions.map((s) => (
                  <div key={s.id} className="sidebar-recent-item text-[11px] py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text)] truncate">
                        {s.course?.title || "Session"}
                      </p>
                      {s.userName && (
                        <p className="text-[9px] text-[var(--color-text-subtle)] mt-0.5 truncate">
                          {s.userName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <Link
          href="/manager/me"
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors mb-1 cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-full bg-[var(--color-purple)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[var(--color-text)] truncate">
              {user?.name}
            </p>
            <p className="text-[9px] text-[var(--color-text-muted)] truncate capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
