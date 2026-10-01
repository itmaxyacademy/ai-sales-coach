import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.DIRECT_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET ??= "security-check-secret";
process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_KEY ??= "security-check-key";

const [{ createApp }, { env }, jwtModule] = await Promise.all([
  import("./app.js"),
  import("./config/env.js"),
  import("jsonwebtoken"),
]);
const jwt = jwtModule.default;
const companyId = "11111111-1111-1111-1111-111111111111";
const tokenFor = (role: "karyawan" | "company_admin") => jwt.sign({
  sub: role === "karyawan" ? "00000000-0000-0000-0000-000000000004" : "00000000-0000-0000-0000-000000000002",
  email: role === "karyawan" ? "employee@example.test" : "admin@example.test",
  role,
  companyId,
}, env.JWT_SECRET);

const server = createApp().listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const companyAdmin = tokenFor("company_admin");
  const employee = tokenFor("karyawan");

  assert.equal((await fetch(`${baseUrl}/api/tts/voices`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/tts/synthesize`, {
    method: "POST",
    headers: { authorization: `Bearer ${employee}`, "content-type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(5001) }),
  })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/admin/ai-keys`, {
    headers: { authorization: `Bearer ${companyAdmin}` },
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/company/users`, {
    headers: { authorization: `Bearer ${employee}` },
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/auth/demo-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })).status, 400);

  for (let request = 0; request < 30; request++) {
    assert.equal((await fetch(`${baseUrl}/api/ai/__rate_limit_check`, {
      headers: { authorization: `Bearer ${employee}` },
    })).status, 404);
  }
  assert.equal((await fetch(`${baseUrl}/api/ai/__rate_limit_check`, {
    headers: { authorization: `Bearer ${employee}` },
  })).status, 429);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

console.log("Security API checks passed.");
