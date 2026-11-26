import english from "../../public/_locales/en/messages.json" with { type: "json" };

type PopupMessageKey = keyof typeof english;

/** Let the browser pick the locale; use English if it returns no message. */
export function resolvePopupMessage(
  key: PopupMessageKey,
  getMessage: (key: PopupMessageKey) => string,
): string {
  return getMessage(key) || english[key].message;
}
