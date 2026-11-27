import { element } from "../../components/dom.js";

export function renderPublishedContent(page, data) {
  const ambaBase = new URL(window.AMBA_GM_CONFIG?.apiBaseUrl || "/api/v1", location.href);
  function imageUrl(value) {
    try {
      const url = new URL(value, ambaBase.origin);
      return url.protocol === "https:" || (url.origin === ambaBase.origin && url.protocol === "http:") ? url.href : null;
    } catch { return null; }
  }
  const illustration = data.artUrl && imageUrl(data.artUrl);
  if (illustration) {
    const img = element("img");
    img.src = illustration;
    img.alt = data.title;
    page.append(img);
  }
  if (data.bodyHtml) {
    const content = element("div");
    content.className = "gm-content";
    const source = element("template");
    source.innerHTML = data.bodyHtml;
    const allowed = new Set("article section div span p strong em b i small br hr blockquote h1 h2 h3 h4 h5 h6 ul ol li dl dt dd figure figcaption table thead tbody tfoot tr th td details summary pre code".split(" "));
    function copy(parent, nodes) {
      for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) { parent.append(node.textContent); continue; }
        const tag = node.localName;
        if (!tag || ["script","style","iframe","object","form","template","svg"].includes(tag)) continue;
        if (tag === "img") {
          const src = node.getAttribute("src");
          const url = src && imageUrl(src);
          if (url) {
            const img = element("img");
            img.src = url;
            img.alt = node.getAttribute("alt") || "";
            img.loading = "lazy";
            parent.append(img);
          }
        } else if (allowed.has(tag)) {
          const child = element(tag);
          copy(child, node.childNodes);
          parent.append(child);
        } else copy(parent, node.childNodes);
      }
    }
    copy(content, source.content.childNodes);
    page.append(content);
  }
}
