import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Mail, RefreshCw } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import LoadableButton from "./LoadableButton";
import MailSyncProgressBanner from "./MailSyncProgressBanner";
import { useWorkflowPoll } from "../../hooks/useWorkflowPoll";
import { useAuthSession } from "../../lib/auth-context";
import {
  fetchMailSetupStatusApi,
  sendMailboxTest,
  startMailboxTestmailProbe,
  syncMailTransport,
  type MailSetupStatus,
} from "../../lib/api";
import { DEFAULT_MAIL_PROBE_TO } from "../../lib/mail-probe";

const RESEND_GUIDE_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/docs/guides/RESEND_WORKERS_FREE_SETUP.md";

const CLOUDFLARE_MAIL_DOCS_URL =
  "https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/";

type StepState = "done" | "pending" | "warn";

function stepIcon(state: StepState) {
  if (state === "done") {
    return <CheckCircle2 size={18} className="text-[var(--color-neon)] shrink-0" aria-hidden="true" />;
  }
  return (
    <Circle
      size={18}
      className={state === "warn" ? "text-[var(--color-warn)]" : "text-[var(--color-muted)]"}
      aria-hidden="true"
    />
  );
}

/**
 * Guided mail setup checklist with transport status, sync recommendations, and quick test actions.
 */
export default function MailSetupChecklist() {
  const { hasPermission } = useAuthSession();
  const canSyncInfra = hasPermission("deploy.infra");
  const canSendMail = hasPermission("mail.send");
  const canProbeTestmail = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MailSetupStatus | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);
  const mailWorkflowPoll = useWorkflowPoll();

  const load = useCallback(() => {
    setLoading(true);
    fetchMailSetupStatusApi()
      .then((data) => setStatus(data))
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    if (!canSyncInfra) return;
    setSyncing(true);
    setMessage(null);
    try {
      const dispatchedAt = Date.now();
      const res = await syncMailTransport();
      if (res.ok) {
        mailWorkflowPoll.startPoll({
          workflowName: res.workflow ?? "ci-cd.yml",
          dispatchedAfter: dispatchedAt,
          onComplete: () => load(),
        });
        setMessage({
          type: "success",
          text: res.message ?? "Mail sync dispatched — tracking GitHub Actions…",
        });
      } else {
        setMessage({
          type: "error",
          text: res.message ?? "Mail sync failed.",
        });
        load();
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Sync failed" });
    }
    setSyncing(false);
  };

  const handleSendTest = async () => {
    if (!canSendMail) return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await sendMailboxTest(DEFAULT_MAIL_PROBE_TO);
      setMessage({
        type: res.ok ? "success" : "error",
        text: res.message ?? (res.ok ? `Test sent via ${res.transport ?? "mail"}.` : res.reason ?? "Test failed"),
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" });
    }
    setTesting(false);
  };

  const handleTestmailProbe = async () => {
    if (!canProbeTestmail) return;
    setProbing(true);
    setMessage(null);
    try {
      const res = await startMailboxTestmailProbe();
      setMessage({
        type: res.ok ? "success" : "error",
        text: res.ok
          ? `Testmail probe started (tag ${res.tag ?? "—"} → ${res.to ?? "inbox"}).`
          : "Testmail probe failed.",
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Probe failed" });
    }
    setProbing(false);
  };

  const transportDone = status?.transport.configured ?? false;
  const relayDone = status?.transport.relayBound ?? false;
  const resendDone = status?.transport.resendConfigured ?? false;
  const domainVerified = status?.identities.resendDomainVerified ?? false;
  const subscribeOk = !status?.requireMailForSubscribe || status?.mailConfigured;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Mail setup checklist
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Follow these steps to enable outbound mail and subscribe confirmations. API keys stay in Cloudflare Pages
            secrets.
          </p>
        </div>
        {status && (
          <Badge variant={transportDone ? "synced" : "warn"}>
            {transportDone ? status.transport.transport : "Not configured"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      <MailSyncProgressBanner
        status={mailWorkflowPoll.status}
        run={mailWorkflowPoll.run}
        pollError={mailWorkflowPoll.pollError}
        onDismiss={mailWorkflowPoll.dismiss}
      />

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading mail setup status" className="!flex-row !gap-3" />
          <span>Loading mail setup status…</span>
        </div>
      ) : status ? (
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            {stepIcon("done")}
            <div>
              <p className="font-medium text-[var(--color-text)]">1. Read Resend + Workers Free setup guide</p>
              <p className="text-[var(--color-muted)] mt-1">
                {status.setupInstructions?.summary ??
                  "Configure Resend for external subscribers; Cloudflare relay remains for @lorapok.tech."}
              </p>
              <a
                href={RESEND_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-[var(--color-accent-2)] hover:underline"
              >
                Resend setup guide <ExternalLink size={14} />
              </a>
              <a
                href={CLOUDFLARE_MAIL_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 ml-4 text-[var(--color-muted)] hover:underline"
              >
                Cloudflare Email docs <ExternalLink size={14} />
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            {stepIcon(resendDone && domainVerified ? "done" : resendDone ? "warn" : "warn")}
            <div className="flex-1">
              <p className="font-medium text-[var(--color-text)]">
                2. Resend domain ({status.identities.sendingDomain})
              </p>
              <p className="text-[var(--color-muted)] mt-1">
                Verify domain in Resend, then mark <strong>Resend domain verified</strong> in Outbound mail settings.
              </p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  ["Workers Free mode", status.identities.workersFreeMode],
                  ["Resend-first external", status.identities.resendFirstExternal],
                  ["Resend API key", resendDone],
                  ["Domain verified (admin)", domainVerified],
                ].map(([label, ok]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
                  >
                    <dt className="text-[var(--color-muted)]">{label}</dt>
                    <dd>
                      <Badge variant={ok ? "synced" : "warn"}>{ok ? "On" : "Off"}</Badge>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>

          <li className="flex gap-3">
            {stepIcon(transportDone ? "done" : "warn")}
            <div className="flex-1">
              <p className="font-medium text-[var(--color-text)]">3. Transport secrets &amp; relay binding</p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  ["MAIL_RELAY bound", relayDone],
                  ["Cloudflare REST", status.transport.restConfigured],
                  ["Resend API key", resendDone],
                  ["Testmail (E2E)", status.identities.testmailConfigured],
                ].map(([label, ok]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
                  >
                    <dt className="text-[var(--color-muted)]">{label}</dt>
                    <dd>
                      <Badge variant={ok ? "synced" : "warn"}>{ok ? "Ready" : "Missing"}</Badge>
                    </dd>
                  </div>
                ))}
              </dl>
              {status.transport.hint ? (
                <p className="text-xs text-[var(--color-warn)] mt-2">{status.transport.hint}</p>
              ) : null}
            </div>
          </li>

          <li className="flex gap-3">
            {stepIcon(relayDone ? "done" : "warn")}
            <div className="flex-1 space-y-2">
              <p className="font-medium text-[var(--color-text)]">4. Sync up (repair relay + redeploy admin)</p>
              {status.recommendations.length > 0 ? (
                <ul className="list-disc pl-5 text-[var(--color-muted)] space-y-1">
                  {status.recommendations.map((rec) => (
                    <li key={rec}>{rec}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--color-muted)]">Transport looks healthy — sync only if relay was recently changed.</p>
              )}
              <LoadableButton
                type="button"
                loading={syncing}
                disabled={!canSyncInfra}
                onClick={() => void handleSync()}
                className="inline-flex items-center gap-2 text-sm"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Sync up
              </LoadableButton>
            </div>
          </li>

          <li className="flex gap-3">
            {stepIcon(transportDone ? "done" : "pending")}
            <div className="flex-1 space-y-2">
              <p className="font-medium text-[var(--color-text)]">5. Verify delivery</p>
              <div className="flex flex-wrap gap-2">
                <LoadableButton
                  type="button"
                  loading={testing}
                  disabled={!canSendMail || !transportDone}
                  onClick={() => void handleSendTest()}
                  className="text-sm"
                >
                  Send branded test
                </LoadableButton>
                <LoadableButton
                  type="button"
                  loading={probing}
                  disabled={!canProbeTestmail || !status.identities.testmailConfigured}
                  onClick={() => void handleTestmailProbe()}
                  className="text-sm"
                >
                  Testmail probe
                </LoadableButton>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            {stepIcon(subscribeOk ? "done" : "warn")}
            <div>
              <p className="font-medium text-[var(--color-text)]">6. Subscribe gate</p>
              <p className="text-[var(--color-muted)] mt-1">
                Modal {status.subscribeModalEnabled ? "enabled" : "disabled"}
                {status.requireMailForSubscribe ? " · mail required for subscribe" : " · mail optional"}
                {" · "}
                {status.subscribeAvailable ? "subscribe available" : "subscribe blocked until mail is ready"}
              </p>
            </div>
          </li>
        </ol>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Mail status unavailable.</p>
      )}
    </Card>
  );
}
