#!/usr/bin/env node
/**
 * Lightweight CI probe: does ccm-mail-relay exist before Pages deploy?
 * Sets GITHUB_OUTPUT relay_exists=true|false (rate-limited → true to avoid stripping binding).
 */
import { relayWorkerProbeExists } from "./lib/deploy-retry.mjs";
import {
  relayWorkerExists,
  requireDeployToken,
  setGithubActionsOutput,
} from "./lib/mail-credentials.mjs";

const { deployToken, accountId } = requireDeployToken();
const exists = await relayWorkerExists(deployToken, accountId);
const relayExists = relayWorkerProbeExists(exists) || exists === "rate-limited";

if (exists === "rate-limited") {
  console.warn(
    "::warning::ccm-mail-relay probe rate-limited — assuming relay exists so MAIL_RELAY binding stays in wrangler.toml."
  );
} else if (relayExists) {
  console.log("::notice::ccm-mail-relay worker found — Pages deploy will keep MAIL_RELAY binding.");
} else {
  console.warn(
    "::warning::ccm-mail-relay worker not found — Pages deploy may omit MAIL_RELAY (REST fallback only)."
  );
}

setGithubActionsOutput("relay_exists", relayExists ? "true" : "false");
