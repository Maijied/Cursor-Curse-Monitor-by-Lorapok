import assert from "node:assert/strict";
import { formatDeployFailure } from "./firebase-deploy-failure.mjs";

const infoLine =
  "\u001b[36m\u001b[1mi  cloud.firestore:\u001b[22m\u001b[39m checking \u001b[1mfirestore.rules\u001b[22m for compilation errors...";
const realError = "Error: HTTP Error: 403, The caller does not have permission";

assert.equal(
  formatDeployFailure(`${infoLine}\n${realError}`, ""),
  realError,
  "should skip firebase info line and surface HTTP error"
);

assert.equal(
  formatDeployFailure(infoLine, ""),
  infoLine.replace(/\u001b\[[0-9;]*m/g, "").trim(),
  "falls back to stripped output when no explicit error line exists"
);

console.log("firebase-deploy-failure.test.mjs: OK");
