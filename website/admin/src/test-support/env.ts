/** Placeholder used only when CI=true and no admin email env is configured. */
export const CI_TEST_ADMIN_EMAIL = "ci-admin@lorapok.test";

export { DEFAULT_MAIL_PROBE_TO } from "../lib/mail-probe";

/** Admin email for tests — prefer env; never hardcode in individual test files. */
export function getTestAdminEmail(): string {
  const email = (
    process.env.ADMIN_MASTER_EMAIL ||
    process.env.VITE_ADMIN_MASTER_EMAIL ||
    (process.env.CI === "true" ? CI_TEST_ADMIN_EMAIL : "mdshuvo40@gmail.com")
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
