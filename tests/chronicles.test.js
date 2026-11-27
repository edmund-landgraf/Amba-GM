import test from "node:test";
import assert from "node:assert/strict";
import { deriveChronicles, deriveCampaignDashboard, chronicleText } from "../public/src/domain/chronicles.js";
import { newCampaign, changeCampaign } from "../public/src/domain/campaigns.js";

const revision = "2026-11-27T00:00:00Z";
const t = minute => "2026-11-27T01:" + String(minute).padStart(2,"0") + ":00.000Z";
const snapshot = {
  revision,
  tree: [{ kind: "module", children: [
    { typeKey: "acts", children: [{ kind: "container", typeKey: "act", title: "Act 1", pageId: "act",
      children: [{ kind: "container", typeKey: "scene", title: "Forest", pageId: "scene", children: [
        { kind: "container", typeKey: "encounter", title: "Shrine", areaCode: "E1", pageId: "enc" }
      ] }] }] },
    { kind: "pc", title: "Kota", pageId: "pc" }
  ] }],
  pages: { act: { title: "Act 1" }, scene: { title: "Forest" }, enc: { title: "Shrine" }, pc: { title: "Kota" } },
};
const table = { id:"check",title:"Search shrine",degrees:{success:"The symbol is visible.",failure:"No useful clue."} };
const initial = () => newCampaign([], { id:"c1",name:"First table",revision,now:t(0) });
const change = (s,command,minute) => changeCampaign(s.campaigns,{ id:s.campaign.id,revision,expectedVersion:s.campaign.version,command,now:t(minute) });
const start = s => change(s,{type:"start",sessionId:"s1",pageId:"act"},1);
const accept = (s,key,degree="success",minute=2) => change(s,{type:"accept",sessionId:"s1",key,pageId:"enc",table,pcId:"pc",actor:"Kota",degree},minute);
const finish = s => change(s,{type:"end",sessionId:"s1"},4);

test("empty campaign dashboard distinguishes no records from completed events", () => {
  const c=initial().campaign;
  const d=deriveCampaignDashboard(c,snapshot);
  assert.equal(d.completedCount,0);
  assert.equal(d.outcomeCount,0);
  assert.equal(d.activeSession,null);
  assert.equal(d.lastCompleted,null);
  assert.equal(d.lastPosition,null);
  assert.equal(d.nextSessionNumber,1);
  assert.deepEqual(d.chronicles,[]);
});

test("chronicle uses original authored outcome, stable order and story path without mutating inputs", () => {
  const s=finish(accept(accept(start(initial()),"first"),"second","failure"));
  const c=s.campaign;
  const before=JSON.stringify(c);
  const chronicles=deriveChronicles(c,snapshot);
  assert.equal(JSON.stringify(c),before);
  assert.deepEqual(chronicles,deriveChronicles(c,snapshot));
  assert.equal(chronicles[0].elapsedMs,180000);
  assert.deepEqual(chronicles[0].entries.map(o=>o.key),["first","second"]);
  assert.deepEqual(chronicles[0].entries[0].source.path,["Act 1","Forest","E1 Shrine"]);
  assert.equal(chronicles[0].entries[0].text,table.degrees.success);
  assert.equal(chronicles[0].entries[1].text,table.degrees.failure);
  assert.equal(chronicles[0].outcomeCount,2);
  assert.match(chronicleText(c.name,chronicles[0]),/GM-private/);
  assert.match(chronicleText(c.name,chronicles[0]),/Act 1 \/ Forest \/ E1 Shrine/);
});

test("viewed position is a bookmark; no inferred completion or discovery", () => {
  const s=change(start(initial()),{type:"position",sessionId:"s1",pageId:"scene"},2);
  const d=deriveCampaignDashboard(s.campaign,snapshot);
  assert.deepEqual(d.lastPosition.path,["Act 1","Forest"]);
  assert.equal(d.activeSession.outcomeCount,0);
  assert.equal(d.activeSession.elapsedMs,null);
  assert.equal(d.lastCompleted,null);
  assert.match(chronicleText(s.campaign.name,d.activeSession),/Other events may have occurred/);
  assert.equal(d.completedCount,0);
});

test("completed chronicle updates after correction/removal, preserving original chronology", () => {
  const s=finish(accept(accept(start(initial()),"first"),"second"));
  const corrected=change(s,{type:"correct",key:"first",pageId:"enc",table,degree:"failure"},5);
  const entry=deriveChronicles(corrected.campaign,snapshot)[0].entries[0];
  assert.equal(entry.text,table.degrees.failure);
  assert.equal(entry.recordedAt,t(2));
  assert.equal(entry.correctedAt,t(5));
  const removed=change(corrected,{type:"remove",key:"second"},6);
  const next=change(removed,{type:"start",sessionId:"s2"},7);
  const d=deriveCampaignDashboard(next.campaign,snapshot);
  assert.equal(d.completedCount,1);
  assert.equal(d.lastCompleted.outcomeCount,1);
  assert.equal(d.activeSession.number,2);
  assert.equal(d.activeSession.outcomeCount,0);
  assert.equal(d.lastCompleted.entries[0].key,"first");
  assert.doesNotMatch(chronicleText(next.campaign.name,d.lastCompleted),/The symbol is visible/);
  assert.equal(deriveCampaignDashboard(initial().campaign,snapshot).outcomeCount,0);
});

test("changed or absent publication cannot relabel historical source or replace outcome text", () => {
  const s=finish(accept(start(initial()),"first"));
  const changed={...snapshot,revision:"new-revision",pages:{...snapshot.pages,enc:{title:"New shrine"}}};
  for(const source of [changed,undefined]) {
    const d=deriveCampaignDashboard(s.campaign,source);
    assert.equal(d.revisionMatches,false);
    assert.equal(d.lastPosition,null);
    assert.equal(d.lastPageId,"enc");
    assert.equal(d.lastCompleted.entries[0].source,null);
    assert.equal(d.lastCompleted.entries[0].text,table.degrees.success);
    assert.match(chronicleText(s.campaign.name,d.lastCompleted),/Published page enc/);
  }
});
