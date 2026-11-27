import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { postgresCampaignApi, postgresRuntimeEndpoint } from "../server/routes/postgres-campaign-api.mjs";

const audience = "https://gm.fixture.test";
test("PostgreSQL proxy uses only a configured trusted endpoint", () => {
  assert.equal(postgresRuntimeEndpoint("https://amba.fixture.test/api/v1"), "https://amba.fixture.test/api/v1/gm-runtime/execute");
  assert.equal(postgresRuntimeEndpoint("http://127.0.0.1:3000/api/v1/"), "http://127.0.0.1:3000/api/v1/gm-runtime/execute");
  for (const bad of ["http://remote.test/api/v1", "https://user:password@remote.test/api/v1", "https://remote.test/other", "https://remote.test/api/v1?redirect=x"]) assert.throws(() => postgresRuntimeEndpoint(bad));
});
test("proxy forwards only the grant and origin; rejects invalid calls and never falls back to local writes", async () => {
  const calls = [];
  let reply = new Response(JSON.stringify({ result: [{ id: "campaign", version: 4 }] }), { status: 200 });
  const server = createServer(postgresCampaignApi({ endpoint: "https://amba.fixture.test/api/v1/gm-runtime/execute", audience,
    fetchImpl: async (url, options) => { calls.push({ url, options }); if (reply instanceof Error) throw reply; return reply; } }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const send = (body, headers = {}) => fetch(origin, { method: "POST", headers: { Origin: audience, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await send({ token: "grant", ownerId: "other" })).status, 400);
    assert.equal((await send({ token: "grant" }, { Origin: "https://other.test" })).status, 403);
    assert.equal((await send({ token: "grant" }, { Authorization: "Bearer x" })).status, 403);
    assert.equal(calls.length, 0);
    const response = await send({ token: "grant" }, { Cookie: "never-forward=secret" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { result: [{ id: "campaign", version: 4 }] });
    assert.equal(calls[0].url, "https://amba.fixture.test/api/v1/gm-runtime/execute");
    assert.deepEqual(JSON.parse(calls[0].options.body), { token: "grant" });
    assert.equal(calls[0].options.headers.Cookie, undefined);
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.redirect, "error");
    reply = new Response(JSON.stringify({ error: "Campaign changed." }), { status: 409 });
    const conflict = await send({ token: "grant" });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { error: "Campaign changed." });
    reply = new Error("private upstream failure");
    const failed = await send({ token: "grant" });
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /private upstream failure/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
