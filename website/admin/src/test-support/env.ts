/** Placeholder used when no admin email env is configured in tests. */
export const CI_TEST_ADMIN_EMAIL = "ci-admin@lorapok.test";

export { DEFAULT_MAIL_PROBE_TO } from "../lib/mail-probe";

/** Admin email for tests — from env or cred-vault-backed CI secret; never hardcode personal addresses. */
export function getTestAdminEmail(): string {
  const email = (
    process.env.ADMIN_MASTER_EMAIL ||
    process.env.VITE_ADMIN_MASTER_EMAIL ||
    CI_TEST_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      "Admin test email is not configured. Set ADMIN_MASTER_EMAIL (GitHub Actions secret / CI) " +
        "or VITE_ADMIN_MASTER_EMAIL in website/admin/.env for local runs."
    );
  }

  return email;
}
