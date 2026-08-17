/** Admin email for tests — never hardcode in test files. */
export function getTestAdminEmail(): string {
  const email = (
    process.env.ADMIN_MASTER_EMAIL ||
    process.env.VITE_ADMIN_MASTER_EMAIL ||
    ""
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
