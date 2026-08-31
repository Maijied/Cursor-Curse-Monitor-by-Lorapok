const assert = require("assert");

require("ts-node").register({ transpileOnly: true });
const { editorProcessPatterns } = require("../src/cursorAuth.ts");

const dCursorPatterns = editorProcessPatterns("cursor", "dCursor");
assert.ok(dCursorPatterns.includes("cursor"), "dCursor host must detect cursor binary");

const windsurfPatterns = editorProcessPatterns("cursor", "Windsurf");
assert.ok(windsurfPatterns.includes("Windsurf"));

const codePatterns = editorProcessPatterns("vscode", "Code");
assert.ok(codePatterns.includes("code"));
assert.equal(codePatterns.includes("cursor"), false);

console.log("editor-process-patterns test passed");
