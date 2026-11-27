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

export function projectStoryActs(tree) {
  const moduleRoot = (tree || []).find(node => node?.kind === "module");
  const acts = moduleRoot?.children?.find(node => node?.typeKey === "acts");
  return projectStoryNodes(acts?.children);
}

