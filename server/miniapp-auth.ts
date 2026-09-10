import { createHmac, timingSafeEqual } from "node:crypto";
export interface MiniAppUser {
  id: number;
  language_code?: string;
}
export function validateMiniAppData(
  raw: unknown,
  token: string,
  owners: string[],
  now = Date.now(),
): MiniAppUser | null {
  if (typeof raw !== "string" || raw.length > 10000 || !token) return null;
  const params = new URLSearchParams(raw);
  if ([...params.keys()].length !== new Set(params.keys()).size) return null;
  const hash = params.get("hash") || "";
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  params.delete("hash");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret)
    .update(
      [...params.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    )
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;
  const date = Number(params.get("auth_date"));
  if (
    !Number.isSafeInteger(date) ||
    date <= 0 ||
    now / 1000 - date > 300 ||
    date - now / 1000 > 30
  )
    return null;
  try {
    const user = JSON.parse(params.get("user") || "null") as MiniAppUser | null;
    if (
      !user ||
      !Number.isSafeInteger(user.id) ||
      !owners.includes(String(user.id))
    )
      return null;
    return user;
  } catch {
    return null;
  }
}
