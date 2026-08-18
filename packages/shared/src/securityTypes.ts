export type SecurityFindingKind =
  | "api_key"
  | "bearer_token"
  | "password"
  | "private_key"
  | "jwt"
  | "email_credential";

export type SecuritySeverity = "high" | "medium";

export interface SecurityFinding {
  id: string;
  kind: SecurityFindingKind;
  location: string;
  snippet: string;
  severity: SecuritySeverity;
  line?: number;
  column?: number;
}

export interface ScanSecretsOptions {
  location?: string;
  context?: "workspace" | "paste" | "clipboard";
  allowCursorToken?: boolean;
}
