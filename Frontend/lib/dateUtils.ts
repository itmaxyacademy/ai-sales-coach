/**
 * Single, unified date formatting utility across the entire application.
 * Default output: "8 Agu 2026" (Standard Indonesian Date Format)
 */
export function formatDate(
  dateInput?: string | Date | null,
  options?: {
    monthFormat?: "short" | "long" | "numeric";
    includeYear?: boolean;
  }
): string {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    const monthFormat = options?.monthFormat ?? "short";
    const includeYear = options?.includeYear ?? true;

    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: monthFormat,
      ...(includeYear ? { year: "numeric" } : {}),
    });
  } catch {
    return "-";
  }
}

/**
 * Format relative date/time (e.g., "Hari ini", "Kemarin", "8 Agu 2026")
 */
export function formatRelativeDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) return "Hari ini";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Kemarin";

    return formatDate(d, { monthFormat: "short", includeYear: d.getFullYear() !== now.getFullYear() });
  } catch {
    return "-";
  }
}
