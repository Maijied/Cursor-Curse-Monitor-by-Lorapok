/**
 * Confirm destructive or major actions across IDE, browser, admin, and website.
 * Returns true only when the user explicitly confirms.
 */
export type ConfirmSeverity = "info" | "warning" | "destructive";

export interface ConfirmActionOptions {
  title: string;
  message: string;
  severity?: ConfirmSeverity;
  confirmLabel?: string;
  cancelLabel?: string;
}

export type ConfirmHandler = (options: ConfirmActionOptions) => Promise<boolean>;

let handler: ConfirmHandler = defaultBrowserConfirm;

type GlobalWithConfirm = typeof globalThis & {
  confirm?: (message?: string) => boolean;
};

function readBrowserConfirm(): ((message?: string) => boolean) | undefined {
  const confirmFn = (globalThis as GlobalWithConfirm).confirm;
  return typeof confirmFn === "function" ? confirmFn : undefined;
}

function defaultBrowserConfirm(options: ConfirmActionOptions): Promise<boolean> {
  const confirmFn = readBrowserConfirm();
  if (!confirmFn) return Promise.resolve(false);
  const prefix =
    options.severity === "destructive" ? "⚠️ DESTRUCTIVE\n\n" : options.severity === "warning" ? "⚠️\n\n" : "";
  return Promise.resolve(confirmFn(`${prefix}${options.title}\n\n${options.message}`));
}

/** Override for VS Code window.showWarningMessage, admin modal, etc. */
export function setConfirmHandler(next: ConfirmHandler): void {
  handler = next;
}

export function resetConfirmHandler(): void {
  handler = defaultBrowserConfirm;
}

export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return handler({
    severity: "warning",
    confirmLabel: "Continue",
    cancelLabel: "Cancel",
    ...options,
  });
}

/** Run fn only after confirmation; no-op if cancelled. */
export async function withConfirmedAction<T>(
  options: ConfirmActionOptions,
  fn: () => Promise<T> | T
): Promise<T | undefined> {
  const ok = await confirmAction(options);
  if (!ok) return undefined;
  return fn();
}
