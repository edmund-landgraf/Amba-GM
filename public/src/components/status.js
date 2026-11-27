import { $ } from "./dom.js";

const message = $("message");
export function setMessage(text = "", kind = "") {
  message.textContent = text;
  message.dataset.kind = kind;
}
