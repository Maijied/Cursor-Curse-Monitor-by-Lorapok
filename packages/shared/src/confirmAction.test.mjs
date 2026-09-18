/**
 * ECO-08 — confirmAction contract.
 */
import assert from "node:assert/strict";
import {
  confirmAction,
  resetConfirmHandler,
  setConfirmHandler,
  withConfirmedAction,
} from "../dist/confirmAction.js";

resetConfirmHandler();

let calls = 0;
setConfirmHandler(async (options) => {
  calls += 1;
  assert.equal(options.title, "Test");
  assert.equal(options.severity, "destructive");
  return options.confirmLabel === "Yes";
});

const denied = await confirmAction({
  title: "Test",
  message: "Nope",
  severity: "destructive",
  confirmLabel: "No",
});
assert.equal(denied, false);
assert.equal(calls, 1);

const allowed = await withConfirmedAction(
  { title: "Test", message: "Go", severity: "destructive", confirmLabel: "Yes" },
  async () => "ran"
);
assert.equal(allowed, "ran");
assert.equal(calls, 2);

resetConfirmHandler();
console.log("confirmAction.test.mjs: OK");
