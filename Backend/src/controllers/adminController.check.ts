import assert from "node:assert/strict";
import { buildAdminSessionWhere } from "./adminController.js";
import { parsePage } from "../lib/http-query.js";

const filters = buildAdminSessionWhere({
  employee: "Ayu",
  team: "Jakarta",
  course: "Discovery",
  from: "2026-09-01",
  to: "2026-09-30",
  minScore: "60",
  maxScore: "90",
  status: "all",
}, { role: "company_admin", companyId: "company-1" });

const userFilter = filters.user as unknown as {
  companyId: string;
  OR: [{ name: { contains: string } }, unknown];
  team: { name: { contains: string } };
};
const courseFilter = filters.course as unknown as { title: { contains: string } };
const scoreFilter = filters.totalScore as unknown as { gte: number; lte: number };
const dateFilter = filters.startedAt as unknown as { lte: Date };
assert.equal(userFilter.companyId, "company-1");
assert.equal(userFilter.OR[0].name.contains, "Ayu");
assert.equal(userFilter.team.name.contains, "Jakarta");
assert.equal(courseFilter.title.contains, "Discovery");
assert.equal(scoreFilter.gte, 60);
assert.equal(scoreFilter.lte, 90);
assert.equal(dateFilter.lte.getUTCHours(), 23);
assert.equal(filters.status, undefined);
assert.throws(() => buildAdminSessionWhere({ minScore: "101" }, { role: "super_admin" }), /0 dan 100/);
assert.equal(parsePage(undefined), 1);
assert.equal(parsePage("4"), 4);
assert.throws(() => parsePage("0"), /Nomor halaman tidak valid/);
