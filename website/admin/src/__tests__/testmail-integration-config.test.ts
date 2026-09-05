import { describe, expect, it } from "vitest";
import {
  normalizeTestmailIntegrationConfig,
  sanitizeTestmailIntegrationForClient,
  testmailSecretsToGithubMap,
  isTestmailProbeEnabled,
} from "../../functions/api/_shared/testmail-integration-config.js";

describe("testmail-integration-config", () => {
  it("disables probes by default", () => {
    const config = normalizeTestmailIntegrationConfig({});
    expect(config.probeEnabled).toBe(false);
    expect(isTestmailProbeEnabled(config)).toBe(false);
  });

  it("enables probes only when explicitly true", () => {
    const config = normalizeTestmailIntegrationConfig({ probeEnabled: true });
    expect(isTestmailProbeEnabled(config)).toBe(true);
  });
  it("maps secrets to GitHub env names", () => {
    const secrets = testmailSecretsToGithubMap({
      testmailApiKey: "key",
      testmailNamespace: "my-ns",
    });
    expect(secrets).toEqual({
      TESTMAIL_API_KEY: "key",
      TESTMAIL_NAMESPACE: "my-ns",
    });
  });

  it("masks namespace in client preview", () => {
    const config = normalizeTestmailIntegrationConfig({ namespace: "lorapok-probes" });
    const client = sanitizeTestmailIntegrationForClient(
      config,
      { TESTMAIL_API_KEY: "k", TESTMAIL_NAMESPACE: "lorapok-probes" },
      []
    );
    expect(client.namespacePreview).toBe("···probes");
    expect(client.testmailApiKeyConfigured).toBe(true);
    expect(client.testmailNamespaceConfigured).toBe(true);
  });
});
