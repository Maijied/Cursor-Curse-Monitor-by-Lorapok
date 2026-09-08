import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import { fetchMailSetupStatusApi } from "../../lib/api";

/**
 * Shows whether MAIL_REDIRECT_TO is active (masked) for safe bulk replay / dev sends.
 */
export default function MailRedirectCard() {
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMailSetupStatusApi()
      .then((data) => {
        setConfigured(Boolean(data.redirect?.configured));
        setMasked(data.redirect?.masked ?? null);
      })
      .catch(() => {
        setConfigured(false);
        setMasked(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <ArrowRightLeft size={20} className="text-[var(--color-accent)] shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="font-semibold">Mail redirect target</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            When set, ops scripts and replay tools deliver to this inbox instead of original recipients.
            Configured via <code className="text-xs">MAIL_REDIRECT_TO</code> Pages secret or cred vault{" "}
            <code className="text-xs">mail_redirect_to</code>.
          </p>
        </div>
      </div>
      {loading ? (
        <LorapokLarvaeLoader label="Loading redirect…" />
      ) : configured && masked ? (
        <div className="flex items-center gap-3">
          <Badge variant="synced">Active</Badge>
          <span className="font-[family-name:var(--font-mono)] text-sm">{masked}</span>
        </div>
      ) : (
        <Badge variant="warn">Not configured — sends use original recipients</Badge>
      )}
    </Card>
  );
}
