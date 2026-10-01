"use client";

import React from "react";
import Link from "next/link";

// ── PageHeader ──────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}
export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)] flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ── PeriodSwitcher ──────────────────────────────────
interface PeriodOption {
  key: string;
  label: string;
}
interface PeriodSwitcherProps {
  options: PeriodOption[];
  value: string;
  onChange: (key: string) => void;
}
export function PeriodSwitcher({ options, value, onChange }: PeriodSwitcherProps) {
  return (
    <div className="period-switcher">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`period-btn${value === opt.key ? " active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── SearchInput ─────────────────────────────────────
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}
export function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: SearchInputProps) {
  return (
    <div className={`input-search-wrapper ${className}`}>
      <Search className="search-icon" />
      <input
        type="text"
        className="input-search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── EmptyState ──────────────────────────────────────
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── StatCard ────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  delta?: React.ReactNode;
  footer?: React.ReactNode;
}
export function StatCard({ label, value, icon, iconColor, delta, footer }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={iconColor || "text-[var(--color-accent)]"}>{icon}</span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {delta && <div className="mt-1">{delta}</div>}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}

// ── TabList ─────────────────────────────────────────
interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
}
interface TabListProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}
export function TabList({ tabs, active, onChange }: TabListProps) {
  return (
    <div className="tab-list">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`tab-btn${active === tab.key ? " active" : ""}`}
        >
          <span className="flex items-center gap-1.5">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Alert Banner ────────────────────────────────────
interface AlertProps {
  variant?: "info" | "warning" | "danger" | "success";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
export function Alert({ variant = "info", icon, children, className = "" }: AlertProps) {
  const cls = { info: "alert-info", warning: "alert-warning", danger: "alert-danger", success: "alert-success" }[variant];
  return (
    <div className={`alert ${cls} ${className}`}>
      {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
      <div className="flex-1">{children}</div>
    </div>
  );
}


export { AutoSkeleton } from './AutoSkeleton';
export { ConfirmModal } from './ConfirmModal';
export * from "./DraggableOrgTree";
