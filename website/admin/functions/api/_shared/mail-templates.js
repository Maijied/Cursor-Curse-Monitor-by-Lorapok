import embedded from "./product-context.embedded.json" with { type: "json" };
import { buildMailTemplates } from "../../../../../scripts/mail-templates.mjs";

export function getMailTemplates() {
  return buildMailTemplates(embedded.ctx);
}
