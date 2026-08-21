import React from "react";
import type { SecurityFinding } from "@lorapok/cursor-monitor-shared";

function kindLabel(kind: SecurityFinding["kind"]): string {
  const map: Record<SecurityFinding["kind"], string> = {
    api_key: "API key",
    bearer_token: "Bearer token",
    password: "Password / secret",
    private_key: "Private key",
    jwt: "JWT",
    email_credential: "Account credential",
  };
  return map[kind] ?? kind;
}

interface Props {
  findings: SecurityFinding[];
  onDismiss: () => void;
}

export function SecurityAlertModal({ findings, onDismiss }: Props) {
  if (!findings.length) return null;

  return (
    <div className="security-overlay" role="alertdialog" aria-labelledby="sec-title">
      <div className="security-modal">
        <div className="security-head">
          <h2 id="sec-title">Security Alert</h2>
          <button type="button" className="security-close" onClick={onDismiss} aria-label="Close">
            ×
          </button>
        </div>
        <p className="security-body">
          Sensitive credentials were detected. Remove or rotate them before sharing or committing.
        </p>
        <div className="security-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Type</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className={f.severity === "high" ? "high" : ""}>
                  <td>{f.location}</td>
                  <td>{kindLabel(f.kind)}</td>
                  <td>{f.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="security-foot">
          <button type="button" className="btn ghost" onClick={onDismiss}>
            Dismiss
          </button>
          <button type="button" className="btn danger" onClick={onDismiss}>
            Review finding
          </button>
        </div>
      </div>
    </div>
  );
}
