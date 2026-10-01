import { HttpError } from "./http-error.js";

export function parsePage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new HttpError(400, "Nomor halaman tidak valid.");
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new HttpError(400, "Nomor halaman tidak valid.");
  return page;
}
