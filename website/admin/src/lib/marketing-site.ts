/** Public marketing site (GitHub Pages). */
export const MARKETING_SITE_URL =
  (import.meta.env.VITE_MARKETING_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cursor.lorapok.tech/";
