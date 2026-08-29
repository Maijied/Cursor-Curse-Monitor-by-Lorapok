import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/**
 * Loads the embedded mail templates for the specified environment.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate template values.
 * @return {Array<unknown>} The hydrated mail templates, or an empty array when none are embedded.
 */
export async function getMailTemplates(env) {
  return hydrateTemplateValue(embedded.mailTemplates ?? [], env);
}
