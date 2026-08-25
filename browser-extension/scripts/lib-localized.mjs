/**
 * Safe access to AMO/Mozilla localized fields (e.g. name["en-US"]).
 * Never use dot notation — `obj.en-US` is parsed as subtraction in JS.
 */
export function localizedValue(field, fallback = "") {
  if (field == null) return fallback;
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    return field["en-US"] || field["en_US"] || Object.values(field).find((v) => typeof v === "string") || fallback;
  }
  return fallback;
}
