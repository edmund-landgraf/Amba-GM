const storyContainerTypes = new Set(["act", "scene", "subscene", "encounter", "folder"]);

export function containsPage(node, pageId) {
  return Boolean(pageId && (node?.pageId === pageId || node?.children?.some(child => containsPage(child, pageId))));
}

export function collectPlayerCharacters(nodes) {
  const characters = [];
  for (const node of nodes || []) {
    if (node?.kind === "pc" && node.pageId && node.title) characters.push([node.pageId, node.title]);
    characters.push(...collectPlayerCharacters(node?.children));
  }
  return characters;
}

export function projectStoryNodes(nodes) {
  return (nodes || []).flatMap(node => {
    if (node?.kind !== "narrative" && !(node?.kind === "container" && storyContainerTypes.has(node.typeKey))) return [];
    const children = projectStoryNodes(node.children);
    if (node.typeKey === "folder" && !children.length) return [];
    return [{ ...node, children }];
  });
}

export function filterStoryTree(nodes, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return nodes || [];
  return (nodes || []).flatMap(node => {
    const children = filterStoryTree(node.children, q);
    const hay = [node.areaCode, node.title].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(q) || children.length) return [{ ...node, children }];
    return [];
  });
}

export function locateStoryPages(nodes, ancestors = []) {
  const rows = [];
  for (const node of nodes || []) {
    const chain = [...ancestors, node];
    const place = [...chain].reverse().find(item => item.typeKey === "scene" || item.typeKey === "act");
    if (node.pageId) {
      rows.push({
        pageId: node.pageId,
        title: node.title,
        areaCode: node.areaCode || "",
        placeTitle: place?.title || "Adventure",
      });
    }
    rows.push(...locateStoryPages(node.children, chain));
  }
  return rows;
}

export function groupPagesByPlace(nodes, pageIds) {
  const wanted = new Set(pageIds || []);
  const groups = [];
  const index = new Map();
  for (const row of locateStoryPages(nodes)) {
    if (!wanted.has(row.pageId)) continue;
    let group = index.get(row.placeTitle);
    if (!group) {
      group = { placeTitle: row.placeTitle, pages: [] };
      index.set(row.placeTitle, group);
      groups.push(group);
    }
    group.pages.push(row);
  }
  return groups;
}

export function projectStoryActs(tree) {
  const moduleRoot = (tree || []).find(node => node?.kind === "module");
  const acts = moduleRoot?.children?.find(node => node?.typeKey === "acts");
  return projectStoryNodes(acts?.children);
}

