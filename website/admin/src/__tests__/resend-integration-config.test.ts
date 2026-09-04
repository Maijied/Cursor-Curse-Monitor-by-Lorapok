import { describe, expect, it } from "vitest";
import {
  normalizeResendIntegrationConfig,
  resendSecretsToGithubMap,
  sanitizeResendIntegrationForClient,
} from "../../functions/api/_shared/resend-integration-config.js";

describe("resend-integration-config", () => {
  it("maps API secrets to GitHub env names", () => {
    const secrets = resendSecretsToGithubMap({
      resendApiKey: "re_abc",
      resendFrom: "cursor@lorapok.tech",
    });
    expect(secrets).toEqual({
      RESEND_API_KEY: "re_abc",
      RESEND_FROM: "cursor@lorapok.tech",
    });
  });

  it("sanitizes client view without leaking secrets", () => {
    const config = normalizeResendIntegrationConfig({
      sendingDomain: "lorapok.tech",
      resendFromOverride: "Cursor <cursor@lorapok.tech>",
      resendDomainVerified: true,
    });
    const client = sanitizeResendIntegrationForClient(
      config,
      { RESEND_API_KEY: "re_x", RESEND_FROM: "cursor@lorapok.tech" },
      ["RESEND_API_KEY"]
    );
    expect(client.resendApiKeyConfigured).toBe(true);
    expect(client.resendFromConfigured).toBe(true);
    expect(client.secretsPresent).toContain("RESEND_API_KEY");
    expect(client).not.toHaveProperty("resendApiKey");
  });
});
