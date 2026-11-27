export function element(tag, text) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
}

export function button(label, click) {
  const el = element("button", label);
  el.type = "button";
  el.addEventListener("click", click);
  return el;
}
export const $ = (id) => document.getElementById(id);
