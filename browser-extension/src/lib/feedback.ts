import { getOrCreateInstallId } from "./storage";
import {
  submitProductFeedback,
  type FeedbackKind,
  type SubmitProductFeedbackResult,
} from "@lorapok/cursor-monitor-shared";

declare const __EXTENSION_VERSION__: string;

export async function sendExtensionFeedback(params: {
  kind: FeedbackKind;
  message: string;
  source: string;
  email?: string;
}): Promise<SubmitProductFeedbackResult> {
  const installId = await getOrCreateInstallId();
  return submitProductFeedback({
    kind: params.kind,
    message: params.message,
    source: params.source,
    version: __EXTENSION_VERSION__,
    editor: "browser-extension",
    installId,
    email: params.email?.trim() || null,
  });
}
