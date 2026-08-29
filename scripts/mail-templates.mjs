import { buildProductContext } from "./lib-product-context.mjs";
import { buildMailTemplatesFromCards } from "./message-cards.mjs";

/**
 * @param {ReturnType<typeof buildProductContext>} ctx
 */
export function buildMailTemplates(ctx) {
  return buildMailTemplatesFromCards(ctx);
}
