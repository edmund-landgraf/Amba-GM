// Browser smoke against a disposable, mocked AMBA publication; no production calls.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:3010";
const moduleId = "module-smoke";
const revision = "2026-11-27T00:00:00Z";
const snapshot = {
  moduleId, revision,
  tree: [{ kind: "module", children: [
    { typeKey: "acts", children: [{ kind: "container", typeKey: "act", title: "Act 1", pageId: "act1",
      children: [{ kind: "container", typeKey: "scene", title: "Scene 1", pageId: "scene1", children: [
        { kind: "container", typeKey: "encounter", title: "Shrine encounter", pageId: "enc1" }
      ] }] }] },
    { kind: "pc", title: "Kota", pageId: "pc1" }
  ] }],
  pages: {
    act1: { title: "Act 1", challenges: [] },
    scene1: { title: "Scene 1", challenges: [] },
    enc1: { title: "Shrine encounter", challenges: [{
      id: "check1", title: "Shrine check", check: { skills: ["Nature"], dc: 16 },
      degrees: { success: "The symbol is visible.", failure: "No useful clue." }
    }] },
    pc1: { title: "Kota", challenges: [] }
  }
};
const secret = "a".repeat(64);
const data = mkdtempSync(join(tmpdir(), "amba-gm-browser-"));
const startServer = () => spawn(process.execPath, ["tools/dev-server.mjs"], {
  env: { ...process.env, PORT: "3010", AMBA_GM_RUNTIME_SECRET: secret, AMBA_GM_RUNTIME_ORIGIN: origin, AMBA_GM_DATA_DIR: data }, stdio: "inherit"
});
let server = startServer();
let browser;
async function waitForServer() {
  let listening = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(origin)).ok) { listening = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(listening, "local GM server started");
}
const errors = [];
async function newPage(ownerId = "gm-smoke") {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await context.route("**/config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: 'window.AMBA_GM_CONFIG = ' + JSON.stringify({ apiBaseUrl: origin + "/api/v1", appUrl: origin }) + ';'
  }));
  await context.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/gm-runtime-authorize")) {
      const { ownerId: requestedOwner, ...operation } = route.request().postDataJSON();
      if (requestedOwner !== ownerId) return route.fulfill({ status: 403, json: { error: "Wrong account" } });
      if (operation.command?.type === "accept" || operation.command?.type === "correct") {
        const cmd = operation.command;
        const table = snapshot.pages[cmd.pageId]?.challenges.find(t => t.id === cmd.tableId);
        if (!table?.degrees[cmd.degree]) return route.fulfill({ status: 409, json: { error: "Wrong source" } });
        delete cmd.tableId;
        cmd.table = { id: table.id, title: table.title, degrees: { [cmd.degree]: table.degrees[cmd.degree] } };
        if (cmd.type === "accept") cmd.actor = cmd.pcId === "pc1" ? "Kota" : "Party";
      }
      const iat = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({ v: 1, aud: origin, sub: ownerId, moduleId, iat, exp: iat + 60, operation })).toString("base64url");
      return route.fulfill({ json: { token: payload + "." + createHmac("sha256", Buffer.from(secret, "hex")).update(payload).digest("base64url") } });
    }
    const responses = {
      "/api/v1/auth/me": { user: { id: ownerId } },
      "/api/v1/modules": [{ id: moduleId, title: "Smoke adventure", publicationStatus: "published" }],
      ["/api/v1/modules/" + moduleId + "/syndication"]: { syndications: { full: { url: origin + "/syndicate/smoke", publishedPageIds: Object.keys(snapshot.pages) } } },
      ["/api/v1/modules/" + moduleId + "/syndication/gm"]: snapshot
    };
    if (!Object.hasOwn(responses, path)) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: responses[path] });
  });
  return page;
}
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  let page = await newPage();
  const button = name => page.getByRole("button", { name, exact: true });
  const visible = async locator => locator.waitFor({ state: "visible", timeout: 10000 });
  async function chooseModule() {
    await page.goto(origin);
    await button("Connect to AMBA").click();
    await page.locator("#module-select").selectOption(moduleId);
    await button("Open GM overview").click();
    await button("Manage campaigns").click();
    await visible(button("Create campaign"));
  }
  await chooseModule();
  await page.getByRole("textbox", { name: "New campaign name" }).fill("First table");
  await button("Create campaign").click();
  await button("Open campaign").click();
  await button("Start session 1").click();
  await visible(button("End session 1"));
  await page.locator("nav details").nth(1).evaluate(el => { el.open = true; });
  await button("Shrine encounter").click();
  await button("Kota").click();
  await button("Success").click();
  await visible(page.getByRole("heading", { name: "Kota · Shrine check · Success", exact: true }));
  console.log("PASS: campaign creation, session start, navigation and accepted outcome");

  // Verify data remains after process restart and in a fresh browser profile.
  await page.context().close();
  const stopped = new Promise(resolve => server.once("exit", resolve));
  server.kill();
  await stopped;
  server = startServer();
  await waitForServer();
  page = await newPage();
  await chooseModule();
  await button("Resume session 1").click();
  await visible(page.getByRole("heading", { name: "Shrine encounter", exact: true }));
  await visible(page.getByRole("heading", { name: "Kota · Shrine check · Success", exact: true }));
  await button("End session 1").click();
  await visible(button("Start session 2"));
  await button("Session and outcome history").click();
  await visible(page.getByRole("heading", { name: "Session 1 · Completed", exact: true }));
  await page.getByText("Correct result", { exact: true }).click();
  await page.getByRole("button", { name: "Correct Shrine check to Failure" }).click();
  await visible(page.getByRole("heading", { name: "Kota · Shrine check · Failure", exact: true }));
  await button("Start session 2").click();
  await visible(button("End session 2"));
  console.log("PASS: server restart, fresh browser, resume, completed history correction and next session");

  await button("Back to campaigns").click();
  await page.getByRole("textbox", { name: "New campaign name" }).fill("Second table");
  await button("Create campaign").click();
  await button("Open campaign").click();
  await visible(button("Start session 1"));
  await button("Session and outcome history").click();
  await visible(page.getByText("No accepted outcomes yet.", { exact: true }));
  console.log("PASS: second campaign isolated from first");

  const concurrent = await page.evaluate(async ({ moduleId, revision }) => {
    const { serverCampaignStore } = await import("/src/services/server-campaign-store.js");
    const a = serverCampaignStore("gm-smoke", moduleId);
    const b = serverCampaignStore("gm-smoke", moduleId);
    const c = await a.create({ id: "c", name: "Concurrent test", revision });
    const make = sessionId => ({
      id: c.id, revision: c.revision, expectedVersion: c.version, command: { type: "start", sessionId }
    });
    const results = await Promise.allSettled([a.change(make("s1")), b.change(make("s2"))]);
    const rows = await a.list();
    return { statuses: results.map(r => r.status).sort(), count: rows.find(row => row.id === c.id).sessions.length };
  }, { moduleId, revision });
  assert.deepEqual(concurrent, { statuses: ["fulfilled", "rejected"], count: 1 });
  assert.deepEqual(errors, []);
  console.log("PASS: server transactions reject stale concurrent writes; no uncaught page errors");
  await page.context().close();
  page = await newPage("gm-other");
  await chooseModule();
  await visible(page.getByText("No campaigns yet. Create one for this publication.", { exact: true }));
  console.log("PASS: another AMBA account sees no private campaigns");
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise(resolve => server.once("exit", resolve));
    server.kill();
    await stopped;
  }
  rmSync(data, { recursive: true, force: true });
}
