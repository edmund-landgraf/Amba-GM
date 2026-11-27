// Browser smoke against a disposable, mocked AMBA publication; no production calls.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { newCampaign, changeCampaign } from "../public/src/domain/campaigns.js";

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
const server = spawn(process.execPath, ["tools/dev-server.mjs"], {
  env: { ...process.env, PORT: "3010" }, stdio: "inherit"
});
let browser;
try {
  let listening = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(origin)).ok) { listening = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(listening, "local GM server started");
  browser = await chromium.launch({ headless: true });
  let context = await browser.newContext();
  let page = await context.newPage();
  let owner = "gm-smoke";
  let unavailable = false;
  const records = new Map();
  const errors = [];
  async function wireContext() {
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await context.route("**/config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: 'window.AMBA_GM_CONFIG = ' + JSON.stringify({ apiBaseUrl: origin + "/api/v1", appUrl: origin }) + ';'
  }));
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const campaignPath = "/api/v1/modules/" + moduleId + "/gm-campaigns";
    if (path === campaignPath || path.startsWith(campaignPath + "/")) {
      if (unavailable) return route.fulfill({ status: 503, json: { error: "Campaign server unavailable." } });
      if (request.headers()["x-amba-gm-owner"] !== owner) return route.fulfill({ status: 409, json: { error: "Account changed." } });
      const scoped = records.get(owner) || [];
      if (request.method() === "GET" && path === campaignPath) return route.fulfill({ json: scoped });
      assert.equal(request.method(), "POST");
      assert.equal(request.headers()["x-amba-gm-request"], "1");
      const body = request.postDataJSON();
      const now = new Date().toISOString();
      try {
        let result;
        if (path === campaignPath) {
          assert.deepEqual(Object.keys(body).sort(), ["id", "name", "revision"]);
          result = newCampaign(scoped, { ...body, now });
        } else {
          assert.deepEqual(Object.keys(body).sort(), ["command", "expectedVersion", "revision"]);
          const command = { ...body.command };
          assert.equal(Object.hasOwn(command, "actor"), false);
          assert.equal(Object.hasOwn(command, "table"), false);
          if (command.type === "accept" || command.type === "correct") {
            command.table = snapshot.pages[command.pageId]?.challenges.find(t => t.id === command.tableId);
            if (!command.table) throw new Error("Unknown published check");
            if (command.type === "accept") command.actor = command.pcId === "pc1" ? "Kota" : "Party";
          }
          result = changeCampaign(scoped, { ...body, id: decodeURIComponent(path.split("/").at(-2)), command, now });
        }
        records.set(owner, result.campaigns);
        return route.fulfill({ json: result.campaign });
      } catch (error) { return route.fulfill({ status: 409, json: { error: error.message } }); }
    }
    const responses = {
      "/api/v1/auth/me": { user: { id: owner } },
      "/api/v1/modules": [{ id: moduleId, title: "Smoke adventure", publicationStatus: "published" }],
      ["/api/v1/modules/" + moduleId + "/syndication"]: { syndications: { full: { url: origin + "/syndicate/smoke", publishedPageIds: Object.keys(snapshot.pages) } } },
      ["/api/v1/modules/" + moduleId + "/syndication/gm"]: snapshot
    };
    if (!Object.hasOwn(responses, path)) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: responses[path] });
  });
  }
  await wireContext();
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

  // A fresh browser context has neither sessionStorage nor IndexedDB from the
  // first context. Resumption must be through the server API.
  await context.close();
  context = await browser.newContext();
  page = await context.newPage();
  await wireContext();
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
  console.log("PASS: fresh browser context resumes server history, correction and next session");

  await button("Back to campaigns").click();
  await page.getByRole("textbox", { name: "New campaign name" }).fill("Second table");
  await button("Create campaign").click();
  await button("Open campaign").click();
  await visible(button("Start session 1"));
  await button("Session and outcome history").click();
  await visible(page.getByText("No accepted outcomes yet.", { exact: true }));
  console.log("PASS: second campaign isolated from first");

  const concurrent = await page.evaluate(async () => {
    const { campaignStore } = await import("/src/services/campaign-store.js");
    const a = campaignStore(indexedDB, "smoke-concurrent");
    const b = campaignStore(indexedDB, "smoke-concurrent");
    const c = await a.create({ id: "c", name: "Concurrent test", revision: "r" });
    const make = sessionId => ({
      id: c.id, revision: c.revision, expectedVersion: c.version, command: { type: "start", sessionId }
    });
    const results = await Promise.allSettled([a.change(make("s1")), b.change(make("s2"))]);
    const rows = await a.list();
    return { statuses: results.map(r => r.status).sort(), count: rows[0].sessions.length };
  });
  assert.deepEqual(concurrent, { statuses: ["fulfilled", "rejected"], count: 1 });
  console.log("PASS: legacy IndexedDB transaction regression");

  await context.close();
  context = await browser.newContext();
  page = await context.newPage();
  owner = "gm-other";
  await wireContext();
  await chooseModule();
  await visible(page.getByText("No campaigns yet. Create one for this publication.", { exact: true }));
  assert.equal(await page.getByText("First table", { exact: true }).count(), 0);
  unavailable = true;
  await button("Create campaign").click();
  await visible(page.getByText("Campaign server unavailable.", { exact: true }));
  assert.equal(records.has("gm-other"), false);
  assert.deepEqual(await page.evaluate(async () => {
    const { campaignStore } = await import("/src/services/campaign-store.js");
    const { campaignScope } = await import("/src/domain/campaigns.js");
    return campaignStore(indexedDB, campaignScope(location.origin + "/api/v1", "gm-other", "module-smoke")).list();
  }), []);
  assert.deepEqual(errors, []);
  console.log("PASS: account isolation and unavailable server never fall back to local writes; no uncaught page errors");
} finally {
  if (browser) await browser.close();
  server.kill();
}
