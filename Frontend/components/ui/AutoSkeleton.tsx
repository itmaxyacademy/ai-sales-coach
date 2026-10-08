"use client";

import React from "react";

export type SkeletonType = 
  | "stats" 
  | "stat-row" 
  | "card" 
  | "table" 
  | "list-card" 
  | "text" 
  | "chart"
  | "course-card"
  | "course-detail"
  | "course-module"
  | "profile"
  | "form"
  | "chart-grid"
  | "analytics";

interface AutoSkeletonProps {
  isLoading: boolean;
  type?: SkeletonType;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  count?: number;   // jumlah card yang di-render
  cols?: number;    // jumlah kolom grid
}

function Sh({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`sk-shimmer ${className}`} {...props} />;
}

function CourseCardShimmer({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col justify-between overflow-hidden">
          <div className="p-5 space-y-4">
            {/* Badges row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Sh className="h-5 w-20 rounded-full" />
                <Sh className="h-5 w-16 rounded-full" />
                <Sh className="h-5 w-24 rounded-full" />
              </div>
              <Sh className="h-5 w-12 rounded-full" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2 pt-1">
              <Sh className="h-5 w-4/5 rounded" />
              <Sh className="h-3 w-full rounded" />
              <Sh className="h-3 w-2/3 rounded" />
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 pt-3 border-t border-[var(--color-border)]">
              <Sh className="h-3.5 w-16 rounded" />
              <Sh className="h-3.5 w-20 rounded" />
            </div>
          </div>

          {/* 5-Column Action Bottom Bar */}
          <div className="grid grid-cols-5 border-t border-[var(--color-border)] divide-x divide-[var(--color-border)] bg-[var(--color-surface)] py-2.5 px-1">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex justify-center">
                <Sh className="h-3.5 w-10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CourseDetailShimmer() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Navigation & Header */}
      <div className="border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sh className="w-9 h-9 rounded-lg flex-shrink-0 mt-1" />
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2">
                <Sh className="h-5 w-20 rounded-full" />
                <Sh className="h-5 w-16 rounded-full" />
                <Sh className="h-5 w-28 rounded-full" />
                <Sh className="h-5 w-14 rounded-full" />
              </div>
              <Sh className="h-7 w-72 sm:w-96 rounded" />
              <Sh className="h-4 w-60 sm:w-80 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sh className="h-9 w-28 rounded-lg" />
            <Sh className="h-9 w-24 rounded-lg" />
            <Sh className="h-9 w-28 rounded-lg" />
            <Sh className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Quick Stat Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-3.5 flex items-center gap-3">
            <Sh className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Sh className="h-3 w-16 rounded" />
              <Sh className="h-4 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Scenario, Persona, Product */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sh className="w-5 h-5 rounded" />
              <Sh className="h-4 w-36 rounded" />
            </div>
            <div className="space-y-2 pt-1">
              <Sh className="h-3 w-full rounded" />
              <Sh className="h-3 w-5/6 rounded" />
              <Sh className="h-3 w-3/4 rounded" />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sh className="w-5 h-5 rounded" />
              <Sh className="h-4 w-40 rounded" />
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
              <Sh className="w-16 h-16 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Sh className="h-4 w-32 rounded" />
                <Sh className="h-3 w-48 rounded" />
                <Sh className="h-3 w-28 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg border border-[var(--color-border)] space-y-2">
                <Sh className="h-3 w-24 rounded" />
                <Sh className="h-3 w-full rounded" />
                <Sh className="h-3 w-4/5 rounded" />
              </div>
              <div className="p-3 rounded-lg border border-[var(--color-border)] space-y-2">
                <Sh className="h-3 w-24 rounded" />
                <Sh className="h-3 w-full rounded" />
                <Sh className="h-3 w-4/5 rounded" />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sh className="w-5 h-5 rounded" />
              <Sh className="h-4 w-36 rounded" />
            </div>
            <div className="space-y-2 pt-1">
              <Sh className="h-3 w-full rounded" />
              <Sh className="h-3 w-5/6 rounded" />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Scoring Rubric & Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sh className="w-5 h-5 rounded" />
              <Sh className="h-4 w-36 rounded" />
            </div>
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] space-y-2 text-center">
              <Sh className="h-8 w-16 mx-auto rounded" />
              <Sh className="h-3 w-28 mx-auto rounded" />
            </div>
            <div className="space-y-3 pt-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Sh className="h-3 w-24 rounded" />
                    <Sh className="h-3 w-10 rounded" />
                  </div>
                  <Sh className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseModuleShimmer() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sh className="w-9 h-9 rounded-lg flex-shrink-0 mt-1" />
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2">
                <Sh className="h-5 w-20 rounded-full" />
                <Sh className="h-5 w-16 rounded-full" />
                <Sh className="h-5 w-28 rounded-full" />
              </div>
              <Sh className="h-7 w-72 sm:w-96 rounded" />
              <Sh className="h-4 w-60 sm:w-80 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sh className="h-9 w-32 rounded-lg" />
            <Sh className="h-9 w-32 rounded-lg" />
            <Sh className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-3.5 flex items-center gap-3">
            <Sh className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Sh className="h-3 w-16 rounded" />
              <Sh className="h-4 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Reader Layout (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 card p-6 md:p-8 space-y-5 min-h-[500px]">
          <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-4">
            <Sh className="h-6 w-56 rounded" />
            <Sh className="h-8 w-24 rounded-lg" />
          </div>
          <div className="space-y-3 pt-2">
            <Sh className="h-5 w-1/3 rounded" />
            <Sh className="h-3.5 w-full rounded" />
            <Sh className="h-3.5 w-full rounded" />
            <Sh className="h-3.5 w-4/5 rounded" />
          </div>
          <div className="p-4 rounded-lg border-l-4 border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
            <Sh className="h-3 w-3/4 rounded" />
            <Sh className="h-3 w-1/2 rounded" />
          </div>
          <div className="space-y-3 pt-3">
            <Sh className="h-5 w-2/5 rounded" />
            <Sh className="h-3.5 w-full rounded" />
            <Sh className="h-3.5 w-5/6 rounded" />
            <Sh className="h-3.5 w-3/4 rounded" />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="card p-5 space-y-3">
            <Sh className="h-4 w-32 rounded" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 5 }).map((_, k) => (
                <Sh key={k} className="h-3.5 w-full rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileDetailShimmer() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Profile Header Banner */}
      <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Sh className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sh className="h-6 w-40 rounded" />
              <Sh className="h-5 w-16 rounded-full" />
            </div>
            <Sh className="h-3.5 w-48 rounded" />
            <Sh className="h-3 w-32 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sh className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Stat Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card space-y-2">
            <Sh className="h-3 w-20 rounded" />
            <Sh className="h-7 w-24 rounded" />
            <Sh className="h-3 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Tabs & Table */}
      <div className="card overflow-hidden">
        <div className="flex gap-4 p-4 border-b border-[var(--color-border)]">
          <Sh className="h-8 w-24 rounded-lg" />
          <Sh className="h-8 w-24 rounded-lg" />
          <Sh className="h-8 w-24 rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] last:border-0">
              <Sh className="h-4 w-48 rounded" />
              <Sh className="h-4 w-20 rounded" />
              <Sh className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsShimmer({ count = 4, cols }: { count?: number; cols?: number }) {
  const gridClass =
    cols === 6 ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" :
    cols === 5 ? "grid-cols-2 md:grid-cols-5" :
    cols === 4 ? "grid-cols-2 md:grid-cols-4" :
    cols === 3 ? "grid-cols-1 md:grid-cols-3" :
    cols === 2 ? "grid-cols-2" :
    count <= 3  ? "grid-cols-1 md:grid-cols-3" :
    count <= 4  ? "grid-cols-2 md:grid-cols-4" :
    count <= 6  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" :
                  "grid-cols-2 md:grid-cols-4";

  return (
    <div className={`grid ${gridClass} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card flex flex-col justify-between" style={{ minHeight: "108px" }}>
          <div className="flex items-center justify-between mb-1.5">
            <Sh className="h-3 w-20 rounded" />
            <Sh className="h-4 w-4 rounded" />
          </div>
          <Sh className="h-8 w-16 rounded mt-1 mb-2" />
          <Sh className="h-3 w-14 rounded" />
        </div>
      ))}
    </div>
  );
}

function StatRowShimmer() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="stat-card flex flex-col gap-2" style={{ minHeight: "120px" }}>
          <div className="flex items-center justify-between mb-1">
            <Sh className="h-3 w-24 rounded" />
            <Sh className="h-4 w-4 rounded" />
          </div>
          <Sh className="h-10 w-20 rounded" />
          <Sh className="h-2.5 w-32 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

function CardShimmer() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Sh className="h-12 w-12 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2.5">
              <Sh className="h-4 w-3/4 rounded" />
              <Sh className="h-3 w-1/2 rounded" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Sh className="h-2.5 w-full rounded" />
            <Sh className="h-2.5 w-5/6 rounded" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] mt-4">
            <Sh className="h-6 w-20 rounded-full" />
            <Sh className="h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableShimmer() {
  return (
    <div className="card overflow-hidden">
      <div className="table-container">
        <table className="data-table w-full">
          <thead>
            <tr>
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="py-[9px] px-[14px]">
                  <Sh className="h-3 w-16 rounded mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className="py-[10px] px-[14px]"><Sh className="h-3 w-8 rounded mx-auto" /></td>
                <td className="py-[10px] px-[14px]">
                  <div className="flex items-center gap-3 justify-center">
                    <Sh className="h-8 w-8 rounded-full flex-shrink-0" />
                    <Sh className="h-3 w-28 rounded" />
                  </div>
                </td>
                <td className="py-[10px] px-[14px]"><Sh className="h-3 w-12 rounded mx-auto" /></td>
                <td className="py-[10px] px-[14px]"><Sh className="h-3 w-16 rounded mx-auto" /></td>
                <td className="py-[10px] px-[14px]"><Sh className="h-5 w-16 rounded-full mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListCardShimmer() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-2">
              <Sh className="h-5 w-5 rounded" />
              <Sh className="h-4 w-3/4 rounded" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Sh className="h-4 w-16 rounded-full" />
              <Sh className="h-4 w-24 rounded-full" />
              <Sh className="h-4 w-20 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Sh className="h-9 w-24 rounded-lg" />
            <Sh className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TextShimmer() {
  return (
    <div className="space-y-3 p-4">
      <Sh className="h-4 w-2/3 rounded" />
      <Sh className="h-3 w-full rounded" />
      <Sh className="h-3 w-5/6 rounded" />
    </div>
  );
}

function ChartShimmer() {
  return (
    <div className="w-full h-full min-h-[200px] border-l border-b border-[var(--color-border)] px-4 pb-0 flex items-end gap-4 mt-6">
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "40%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "70%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "50%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "90%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "65%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "85%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "30%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "75%" }} />
      <Sh className="w-full rounded-t-sm bg-opacity-70" style={{ height: "95%" }} />
    </div>
  );
}

function FormShimmer() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="space-y-2">
        <Sh className="h-7 w-64 rounded" />
        <Sh className="h-4 w-96 rounded" />
      </div>
      <div className="card p-6 space-y-6">
        <div className="p-4 rounded-lg border border-[var(--color-border)] space-y-2">
          <div className="flex justify-between">
            <Sh className="h-4 w-40 rounded" />
            <Sh className="h-5 w-12 rounded" />
          </div>
          <Sh className="h-2 w-full rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Sh className="h-4 w-32 rounded" />
              <Sh className="h-4 w-12 rounded" />
            </div>
            <Sh className="h-3 w-48 rounded" />
            <Sh className="h-3 w-full rounded" />
          </div>
        ))}
        <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
          <Sh className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ChartGridShimmer({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Sh className="h-4 w-44 rounded" />
            <Sh className="h-3 w-24 rounded" />
          </div>
          <ChartShimmer />
        </div>
      ))}
    </div>
  );
}

function AnalyticsShimmer() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card space-y-2">
          <div className="flex justify-between">
            <Sh className="h-3 w-32 rounded" />
            <Sh className="h-4 w-4 rounded" />
          </div>
          <Sh className="h-8 w-20 rounded" />
          <Sh className="h-3 w-28 rounded" />
        </div>
        <div className="stat-card space-y-2">
          <div className="flex justify-between">
            <Sh className="h-3 w-32 rounded" />
            <Sh className="h-4 w-4 rounded" />
          </div>
          <Sh className="h-8 w-20 rounded" />
          <Sh className="h-3 w-28 rounded" />
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <div className="flex justify-between">
          <Sh className="h-4 w-48 rounded" />
          <Sh className="h-3 w-24 rounded" />
        </div>
        <ChartShimmer />
      </div>
    </div>
  );
}

export function AutoSkeleton({ isLoading, type = "card", fallback, children, count, cols }: AutoSkeletonProps) {
  if (isLoading) {
    if (fallback) return <>{fallback}</>;
    if (type === "course-card") return <CourseCardShimmer count={count} />;
    if (type === "course-detail") return <CourseDetailShimmer />;
    if (type === "course-module") return <CourseModuleShimmer />;
    if (type === "profile") return <ProfileDetailShimmer />;
    if (type === "form") return <FormShimmer />;
    if (type === "chart-grid") return <ChartGridShimmer count={count} />;
    if (type === "analytics") return <AnalyticsShimmer />;
    if (type === "stats") return <StatsShimmer count={count} cols={cols} />;
    if (type === "stat-row") return <StatRowShimmer />;
    if (type === "card") return <CardShimmer />;
    if (type === "table") return <TableShimmer />;
    if (type === "list-card") return <ListCardShimmer />;
    if (type === "text") return <TextShimmer />;
    if (type === "chart") return <ChartShimmer />;
  }
  return <>{children}</>;
}
