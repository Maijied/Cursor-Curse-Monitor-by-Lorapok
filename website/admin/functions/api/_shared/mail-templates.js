import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getMailTemplates(env) {
  return hydrateTemplateValue(embedded.mailTemplates ?? [], env);
}
