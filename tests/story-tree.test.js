import test from "node:test";
import assert from "node:assert/strict";
import { collectPlayerCharacters, containsPage, projectStoryActs, projectStoryNodes } from "../public/src/domain/story-tree.js";

test("projects only the Acts story hierarchy and leaves source data untouched", () => {
  const tree = [{ kind: "module", children: [
    { kind: "folder", typeKey: "acts", children: [
      { kind: "container", typeKey: "act", title: "Act 1", children: [
        { kind: "container", typeKey: "scene", title: "Scene", pageId: "scene" },
        { kind: "artifact", typeKey: "map", title: "Map", pageId: "map" },
        { kind: "narrative", title: "Clue", pageId: "clue" },
        { kind: "container", typeKey: "folder", title: "Empty", children: [{ kind: "artifact", title: "Image" }] },
      ] },
    ] },
    { kind: "folder", typeKey: "reference", children: [{ kind: "container", typeKey: "article", title: "Reference", pageId: "reference" }] },
    { kind: "pc", title: "Kota", pageId: "kota" },
  ] }];
  const original = structuredClone(tree);
  const story = projectStoryActs(tree);
  assert.deepEqual(story.map(node => node.title), ["Act 1"]);
  assert.deepEqual(story[0].children.map(node => node.title), ["Scene", "Clue"]);
  assert.equal(JSON.stringify(story).includes("Reference"), false);
  assert.equal(JSON.stringify(story).includes("Map"), false);
  assert.deepEqual(tree, original);
  assert.deepEqual(collectPlayerCharacters(tree), [["kota", "Kota"]]);
});

test("retains supported four-level containers and nested narrative overlays", () => {
  const nodes = [{ kind: "container", typeKey: "act", title: "Act", children: [
    { kind: "container", typeKey: "scene", title: "Scene", children: [
      { kind: "container", typeKey: "subscene", title: "Subscene", children: [
        { kind: "container", typeKey: "encounter", title: "Encounter", pageId: "encounter", children: [
          { kind: "narrative", title: "Story note", pageId: "note" },
        ] },
      ] },
    ] },
  ] }];
  const projected = projectStoryNodes(nodes);
  assert.equal(projected[0].children[0].children[0].children[0].children[0].title, "Story note");
  assert.equal(containsPage(projected[0], "note"), true);
  assert.equal(containsPage(projected[0], "missing"), false);
});

test("handles a 597-page publication without admitting non-story sections", () => {
  const pages = Array.from({ length: 597 }, (_, index) => ({ kind: "container", typeKey: "scene", title: `Page ${index + 1}`, pageId: `page-${index + 1}` }));
  const tree = [{ kind: "module", children: [
    { kind: "folder", typeKey: "acts", children: [{ kind: "container", typeKey: "act", title: "Act", children: pages }] },
    { kind: "folder", typeKey: "reference", children: [{ kind: "container", typeKey: "scene", pageId: "wrong-section" }] },
  ] }];
  const story = projectStoryActs(tree);
  assert.equal(story[0].children.length, 597);
  assert.equal(containsPage(story[0], "page-597"), true);
  assert.equal(containsPage(story[0], "wrong-section"), false);
});

