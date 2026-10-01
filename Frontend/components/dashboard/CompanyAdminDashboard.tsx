"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { Users, Building2, Shield, Activity, ExternalLink, CheckCircle2, Cpu, DollarSign } from "lucide-react";
import { PageHeader, AutoSkeleton, PeriodSwitcher } from "../ui";

interface CompanyStats {
  id: string;
  name: string;
  industry: string;
  website: string | null;
  subscriptionPlan: string;
  maxSeats: number;
  usedSeats: number;
  createdAt: string;
  _count: {
    teams: number;
    users: number;
  };
  totalSessions: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  _count: { members: number };
}

interface PeriodOverview {
  totalSessionsPeriod: number;
  activeUsersPeriod: number;
  assignmentsAssigned: number;
  assignmentsCompleted: number;
  assignmentCompletionRate: number | null;
  totalAiTokens: number;
  estimatedAiCost: number;
}

export default function CompanyAdminDashboard() {
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30days");
  const [overview, setOverview] = useState<PeriodOverview | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get("/company/me"),
      apiClient.get("/company/users?limit=5"), // Assuming we can just slice in frontend if backend doesn't support limit
      apiClient.get("/company/teams"),
      apiClient.get(`/admin/dashboard?period=${period}`),
    ]).then(([meRes, usersRes, teamsRes, overviewRes]) => {
      setStats(meRes?.data || null);
      // Get the latest 5 users
      const allUsers = usersRes?.data || [];
      setRecentUsers(allUsers.slice(0, 5));
      setTeams(teamsRes?.data || []);
      setOverview(overviewRes?.data || null);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  }, [period]);

  const seatsPercentage = stats ? Math.min(Math.round((stats.usedSeats / stats.maxSeats) * 100), 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Company Dashboard"
        subtitle="Manage your company profile, seats, and teams."
        actions={<PeriodSwitcher options={[{ key: "7days", label: "7D" }, { key: "30days", label: "30D" }, { key: "90days", label: "90D" }]} value={period} onChange={setPeriod} />}
      />

      <AutoSkeleton isLoading={loading} type="stats">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Company Info */}
            <div className="card p-5 space-y-4 col-span-1 md:col-span-2 lg:col-span-1 bg-gradient-to-br from-[var(--color-bg)] to-blue-500/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Building2 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{stats.name}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">{stats.industry}</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-[var(--color-border)] text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Registered Since</span>
                  <span className="font-semibold">
                    {new Date(stats.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {stats.website && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Website</span>
                    <a href={stats.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Seat Usage */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">License Seats Usage</span>
                <Users className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-black">{stats.usedSeats}</div>
                <div className="text-sm text-[var(--color-text-muted)] mb-1">/ {stats.maxSeats} active sales reps</div>
              </div>
              <div className="w-full progress-bar mt-4">
                <div 
                  className={`progress-fill ${seatsPercentage > 80 ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-accent)]'}`} 
                  style={{ width: `${seatsPercentage}%` }} 
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                Company Admins and Managers do not consume regular seats.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">Company Structure</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{stats._count.teams} Teams</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Active departments</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{stats._count.users} Total Users</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Including Admins & Managers</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{overview?.totalSessionsPeriod ?? 0} Sessions</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">Roleplays in selected period</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{overview?.activeUsersPeriod ?? 0} Active Employees</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">With a session in this period</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{overview?.assignmentCompletionRate == null ? "-" : `${overview.assignmentCompletionRate}%`} Training Completion</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{overview?.assignmentsCompleted ?? 0} of {overview?.assignmentsAssigned ?? 0} assigned in period</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Cpu className="w-4 h-4 text-purple-500" /></div>
                  <div><div className="text-sm font-bold">{(overview?.totalAiTokens ?? 0).toLocaleString()} AI Tokens</div><div className="text-[10px] text-[var(--color-text-muted)]">Company usage in selected period</div></div>
                </div>
                <div className="flex items-center gap-3 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-500" /></div>
                  <div><div className="text-sm font-bold">${(overview?.estimatedAiCost ?? 0).toFixed(4)}</div><div className="text-[10px] text-[var(--color-text-muted)]">Estimated AI cost in period</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Users */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-sm border-b border-[var(--color-border)] pb-2">Recently Registered Employees</h3>
            {recentUsers.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">No users found.</p>
            ) : (
              <div className="space-y-2">
                {recentUsers.map(user => (
                  <div key={user.id} className="flex justify-between items-center p-2 rounded hover:bg-[var(--color-bg)]">
                    <div>
                      <div className="font-semibold text-sm">{user.name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{user.email}</div>
                    </div>
                    <span className="badge badge-gray text-[10px] capitalize">{user.role.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teams Overview */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-sm border-b border-[var(--color-border)] pb-2">Teams Overview</h3>
            {teams.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">No teams created yet.</p>
            ) : (
              <div className="space-y-2">
                {teams.map(team => (
                  <div key={team.id} className="flex justify-between items-center p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <span className="font-semibold text-sm">{team.name}</span>
                    <span className="badge badge-blue text-[10px]">{team._count.members} Members</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AutoSkeleton>
    </div>
  );
}
