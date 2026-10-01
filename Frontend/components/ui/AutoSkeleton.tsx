"use client";

import React from "react";

export type SkeletonType = "stats" | "stat-row" | "card" | "table" | "list-card" | "text" | "chart";

interface AutoSkeletonProps {
  isLoading: boolean;
  type?: SkeletonType;
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

export function AutoSkeleton({ isLoading, type = "card", children, count, cols }: AutoSkeletonProps) {
  if (isLoading) {
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
