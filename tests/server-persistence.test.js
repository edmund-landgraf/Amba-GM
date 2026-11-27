import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { verifyRuntimeGrant } from "../server/auth/runtime-grant.mjs";
import { openCampaignRepository } from "../server/storage/campaign-repository.mjs";
import { campaignApi } from "../server/routes/campaign-api.mjs";

const secret = "a".repeat(64), audience = "http://localhost:3010";
const grant = (operation, extra = {}) => ({ v: 1, aud: audience, sub: "gm1", moduleId: "mod1", iat: 100, exp: 160, operation, ...extra });
function sign(g, key = secret) {
  const payload = Buffer.from(JSON.stringify(g)).toString("base64url");
  return payload + "." + createHmac("sha256", Buffer.from(key, "hex")).update(payload).digest("base64url");
}
const list = { action: "list" };
test("signed grant rejects wrong secret, audience, tampering and expired/future tokens", () => {
  const g = grant(list);
  assert.deepEqual(verifyRuntimeGrant(sign(g), secret, audience, 120000), g);
  for (const token of [sign(g, "b".repeat(64)), sign(grant(list,{aud:"https://other.test"})), sign(grant(list,{iat:200,exp:260})), sign(g).replace(/.$/,"!"), "bad"]) {
    assert.equal(verifyRuntimeGrant(token, secret, audience, 120000), null);
  }
  assert.equal(verifyRuntimeGrant(sign(g), secret, audience, 160000), null);
});
test("SQLite survives close/reopen; isolates owner/module and rejects stale or duplicate commands", () => {
  const dir = mkdtempSync(join(tmpdir(), "amba-gm-test-"));
  const file = join(dir, "campaigns.sqlite");
  let repo;
  try {
    const clock = () => "2026-11-27T01:00:00Z";
    repo = openCampaignRepository(file, clock);
    const create = { action: "create", id:"c1", name:"First", revision:"r1" };
    const first = repo.execute(grant(create));
    const start = { action:"change", id:"c1", revision:"r1", expectedVersion:first.version, command:{type:"start",sessionId:"s1",pageId:"p1"} };
    const started = repo.execute(grant(start));
    assert.throws(() => repo.execute(grant(start)), /another view/);
    assert.throws(() => repo.execute(grant(create)), /identity/);
    assert.deepEqual(repo.execute(grant(list,{sub:"gm2"})), []);
    assert.deepEqual(repo.execute(grant(list,{moduleId:"mod2"})), []);
    const accept = { action:"change",id:"c1",revision:"r1",expectedVersion:started.version,command:{type:"accept",sessionId:"s1",key:"o1",pageId:"p1",table:{id:"check",title:"Check",degrees:{success:"Authored narrative"}},pcId:null,actor:"Party",degree:"success"} };
    repo.execute(grant(accept));
    repo.close();
    repo = openCampaignRepository(file,clock);
    const rows = repo.execute(grant(list));
    assert.equal(rows[0].outcomes[0].outcomeText,"Authored narrative");
    assert.equal(rows[0].sessions[0].id,"s1");
    assert.throws(() => repo.execute(grant(accept)), /another view/);
    assert.throws(() => repo.execute(grant({...accept,expectedVersion:rows[0].version})), /already recorded/);
    assert.equal(repo.execute(grant(list))[0].outcomes.length,1);
  } finally { repo?.close(); rmSync(dir,{recursive:true,force:true}); }
});
test("HTTP route requires signed authorization and ignores forged outer identity", async () => {
  const repo = openCampaignRepository(":memory:");
  const server = createServer(campaignApi({ repository:repo, secret, audience }));
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const url = "http://127.0.0.1:"+server.address().port;
  const now = Math.floor(Date.now()/1000);
  const call = (body, origin=audience) => fetch(url,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
  try {
    assert.equal((await call({token:"bad"})).status,401);
    const token = sign(grant({action:"create",id:"c1",name:"Test",revision:"r"},{iat:now,exp:now+60}));
    assert.equal((await call({token},"https://untrusted.test")).status,403);
    const created = await call({token,ownerId:"forged",moduleId:"forged"});
    assert.equal(created.status,200);
    assert.equal((await created.json()).result.id,"c1");
    const other = await call({token:sign(grant(list,{iat:now,exp:now+60,sub:"forged"}))});
    assert.deepEqual((await other.json()).result,[]);
    assert.equal((await call({token})).status,409);
  } finally { await new Promise(resolve => server.close(resolve)); repo.close(); }
});
