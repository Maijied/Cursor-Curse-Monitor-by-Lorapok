#!/usr/bin/env node
const input = await new Promise((resolve) => {
  let value = "";
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolve(value));
});
let command = "";
try { command = JSON.parse(input).command ?? ""; } catch { /* malformed hook input is handled by the host */ }
const risky = /git\s+(commit|push)|npm\s+run\s+(package|publish)|wrangler\s+pages\s+deploy|\.github\/workflows/.test(command);
console.log(JSON.stringify(risky
  ? { permission: "ask", user_message: "This command can publish, deploy, or change release automation. Review it before continuing.", agent_message: "Risky command requires explicit confirmation." }
  : { permission: "allow" }));
