export const MASTER_ADMIN =
  (import.meta.env.VITE_ADMIN_MASTER_EMAIL as string | undefined)?.toLowerCase() ||
  "admin@lorapok.tech";

export function isMasterAdmin(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase() === MASTER_ADMIN);
}
