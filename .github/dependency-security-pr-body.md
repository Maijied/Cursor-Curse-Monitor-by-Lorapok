## Summary

Automated remediation PR from **Dependency Security Bot** (`workflow_dispatch` → remediate).

- Applies `npm audit fix --omit=dev` to root and `website/admin` lockfiles
- Runs the full test suite before opening this PR
- Aligns with [Managing Dependabot alerts](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-dependabot-alerts/viewing-and-updating-dependabot-alerts)

## Test plan

- [ ] CI / Dependency Security Bot scan passes
- [ ] `npm test` green locally if you pull this branch
- [ ] Dismiss any remaining dev-tooling alerts in `.github/dependency-security-dismissals.json` if not upgrading yet
