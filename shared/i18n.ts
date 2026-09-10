import { de } from "./de.js";
export type Language = "uk" | "de";
export const languageOf = (value: unknown): Language =>
  typeof value === "string" && value.toLowerCase().startsWith("de")
    ? "de"
    : "uk";
export function translate(
  language: Language,
  text: string,
  values: Record<string, string | number> = {},
) {
  const key = text.replace(/\s+/g, " ").trim();
  let result =
    language === "de"
      ? (de[text] ??
        (de[key]
          ? (text.match(/^\s+/)?.[0] || "") +
            de[key] +
            (text.match(/\s+$/)?.[0] || "")
          : text))
      : text;
  for (const [name, value] of Object.entries(values))
    result = result.replaceAll("{" + name + "}", String(value));
  if (language === "de")
    result = result
      .replaceAll(" / год", " / Std.")
      .replaceAll(" / місяць", " / Monat")
      .replaceAll(" · Початок:", " · Beginn:");
  return result;
}
export const localizedDate = (language: Language, value: string) =>
  new Intl.DateTimeFormat(language === "de" ? "de-DE" : "uk-UA", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
