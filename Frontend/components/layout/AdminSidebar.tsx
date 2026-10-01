"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { useSidebarStore } from "../../store/sidebarStore";
import { useRouter } from "next/navigation";
import { apiClient } from "../../lib/api/client";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Bell,
  LogOut,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Flame,
  MonitorDot,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  Network,
  Cpu,
} from "lucide-react";



export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isOpen } = useSidebarStore();
  const router = useRouter();


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
      .slice(0, 2) || "A";

  const isSuperAdmin = user?.role === "super_admin";

  // Admin / Super Admin menu - fokus pada sistem & operasional
  const navigation = [
    {
      section: isSuperAdmin ? "System" : "Organization",
      items: [
        ...(isSuperAdmin
          ? [
              { name: "Strategic Overview", href: "/admin/strategic", icon: BarChart3 },
              { name: "System Control", href: "/admin/dashboard", icon: MonitorDot },
              { name: "AI Token Usage", href: "/admin/token-report", icon: Cpu }
            ]
          : [
              { name: "Company Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }
            ]),
        { name: "User Management", href: "/admin/users", icon: Users },
        ...(!isSuperAdmin ? [{ name: "Team Management", href: "/admin/teams", icon: Network }] : []),
      ],
    },
    {
      section: "Content",
      items: [
        { name: "Courses", href: "/admin/courses", icon: BookOpen },
        { name: "Sessions", href: "/admin/sessions", icon: ScrollText },
      ],
    },
    {
      section: "Communication",
      items: [
        { name: "Notifications", href: "/admin/notifications", icon: Bell },
      ],
    },
    // {
    //   section: "Settings",
    //   items: [
    //     { name: "AI Knowledge Base", href: "/admin/ai-context", icon: Bot },
    //   ],
    // },
  ];

  return (
    <div className={`sidebar ${!isOpen ? "collapsed" : ""}`}>
      <div 
        className={`sidebar-logo flex w-full mb-4 relative transition-all duration-300 ${
          isOpen ? "flex-row items-center justify-between pr-2" : "flex-col items-center justify-center gap-4 py-2"
        }`}
      >
        <Link 
          href="/admin/dashboard" 
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
      </nav>



      <div className="sidebar-footer">
        {/* User info */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg mb-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
              isSuperAdmin ? "bg-[var(--color-purple)]" : "bg-[var(--color-accent)]"
            }`}
          >
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
        </div>
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
