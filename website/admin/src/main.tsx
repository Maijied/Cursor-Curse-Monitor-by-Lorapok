import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { bootstrapFirebase } from "./lib/firebase";

const rootEl = document.getElementById("root");

function renderBootstrapError(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:auto;color:#f8fafc;background:#0f172a;min-height:100vh">
    <h1 style="color:#f87171;margin-bottom:0.75rem">Firebase not configured</h1>
    <p style="color:#94a3b8;line-height:1.5">${message}</p>
  </div>`;
}

bootstrapFirebase()
  .then(() => {
    if (!rootEl) return;
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Firebase bootstrap failed";
    renderBootstrapError(message);
  });
