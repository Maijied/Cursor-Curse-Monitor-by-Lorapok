import { Link } from "react-router-dom";
import { Inbox, Mail as MailIcon } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import MailSetupChecklist from "../ui/MailSetupChecklist";
import MailTransportCard from "../ui/MailTransportCard";
import MailRedirectCard from "../ui/MailRedirectCard";
import EmailIdentitiesCard from "../ui/EmailIdentitiesCard";
import ResendConfigCard from "../ui/ResendConfigCard";
import { useAuthSession } from "../../lib/auth-context";

/**
 * Dedicated Mission Control mail hub — transport, aliases, Resend, and redirect status.
 */
export default function Mail() {
  const { hasPermission } = useAuthSession();
  const canCompose = hasPermission("mail.send");
  const canEditResend = hasPermission("integrations.write");

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <PageHeader
        title="Mail"
        description="Outbound transport, email identities, Resend fallback, and delivery redirect — separate from the message log in Mailbox."
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Inbox size={22} className="text-[var(--color-accent)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold">Mailbox</h3>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Read sent mail, preview HTML, and {canCompose ? "compose branded messages" : "review delivery history"}.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/mailbox"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-white/5 text-sm font-medium shrink-0"
          >
            <MailIcon size={16} aria-hidden="true" />
            Open Mailbox
          </Link>
        </div>
      </Card>

      <MailRedirectCard />
      <EmailIdentitiesCard />
      <MailSetupChecklist />
      <MailTransportCard />
      {canEditResend ? (
        <ResendConfigCard />
      ) : (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            Resend domain settings require <code className="text-xs">integrations.write</code>. Ask an admin to update
            Resend verification in Settings → Resend.
          </p>
        </Card>
      )}
    </div>
  );
}
