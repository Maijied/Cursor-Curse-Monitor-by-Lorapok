import browser from "webextension-polyfill";
import {
  emailFromCursorToken,
  jwtFromWorkosCursorSessionCookie,
} from "@lorapok/cursor-monitor-shared";
import { saveToken } from "./storage";

async function readSessionCookie(): Promise<string | null> {
  const urls = ["https://cursor.com/", "https://www.cursor.com/"];
  for (const url of urls) {
    const cookies = await browser.cookies.getAll({ url });
    const session = cookies.find((cookie) => cookie.name === "WorkosCursorSessionToken");
    if (session?.value) {
      return session.value;
    }
  }
  const domainCookies = await browser.cookies.getAll({ domain: ".cursor.com" });
  const session = domainCookies.find((cookie) => cookie.name === "WorkosCursorSessionToken");
  return session?.value ?? null;
}

/** Read WorkosCursorSessionToken from cursor.com and persist the embedded JWT. */
export async function captureAuthFromCursorCookies(): Promise<boolean> {
  const cookieValue = await readSessionCookie();
  if (!cookieValue) {
    return false;
  }
  const token = jwtFromWorkosCursorSessionCookie(cookieValue);
  if (!token) {
    return false;
  }
  await saveToken(token, emailFromCursorToken(token));
  return true;
}
