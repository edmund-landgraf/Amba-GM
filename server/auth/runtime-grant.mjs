import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRuntimeGrant(token, secret, audience, now = Date.now()) {
  if (typeof token !== "string" || token.length > 120000 || !/^[a-f0-9]{64}$/i.test(secret)) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", Buffer.from(secret, "hex")).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const g = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const t = Math.floor(now / 1000);
    if (g.v !== 1 || g.aud !== audience || typeof g.sub !== "string" || !g.sub ||
      typeof g.moduleId !== "string" || !g.moduleId || !Number.isSafeInteger(g.iat) ||
      !Number.isSafeInteger(g.exp) || g.exp !== g.iat + 60 || g.iat > t + 5 || g.exp <= t ||
      !["list", "create", "change"].includes(g.operation?.action)) return null;
    return g;
  } catch { return null; }
}
