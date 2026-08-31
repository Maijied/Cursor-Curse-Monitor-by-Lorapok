import { ADMIN_PANEL_URL, type FeedbackKind } from "./productLinks";

export const FEEDBACK_API_URL = `${ADMIN_PANEL_URL}/api/feedback`;

export type SubmitProductFeedbackParams = {
  kind?: FeedbackKind;
  message: string;
  source: string;
  version?: string;
  editor?: string;
  installId?: string | null;
  email?: string | null;
};

export type SubmitProductFeedbackResult = {
  ok: boolean;
  message?: string;
  error?: string;
  warning?: string;
  discordDelivered?: boolean;
};

export async function submitProductFeedback(
  params: SubmitProductFeedbackParams
): Promise<SubmitProductFeedbackResult> {
  const message = params.message.trim();
  if (!message) {
    return { ok: false, error: "Message is required" };
  }

  try {
    const response = await fetch(FEEDBACK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        kind: params.kind ?? "general",
        message,
        source: params.source,
        version: params.version,
        editor: params.editor,
        installId: params.installId ?? undefined,
        email: params.email ?? undefined,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as SubmitProductFeedbackResult & {
      error?: string;
    };
    if (!response.ok) {
      return { ok: false, error: body.error || "Could not send feedback right now." };
    }
    return {
      ok: true,
      message: body.message || "Thanks — your feedback was sent.",
      warning: body.warning,
      discordDelivered: body.discordDelivered,
    };
  } catch {
    return { ok: false, error: "Network error — try again later." };
  }
}
