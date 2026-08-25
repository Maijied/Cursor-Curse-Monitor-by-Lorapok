import embedded from "./product-context.embedded.json" with { type: "json" };

export function getMailTemplates() {
  return embedded.mailTemplates ?? [];
}
