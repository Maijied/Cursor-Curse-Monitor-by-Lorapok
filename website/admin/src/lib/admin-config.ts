/** Master admin email from Vite env (local `.env` or CI build secret). */
export const MASTER_ADMIN = (
  (import.meta.env.VITE_ADMIN_MASTER_EMAIL as string | undefined) ?? ""
)
  .trim()
  .toLowerCase();

export function isMasterAdmin(email: string | null | undefined): boolean {
  return Boolean(MASTER_ADMIN && email && email.toLowerCase() === MASTER_ADMIN);
}
