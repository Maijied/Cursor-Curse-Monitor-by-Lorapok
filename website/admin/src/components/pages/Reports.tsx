import { useMemo } from "react";
import { Download, FileText, Printer } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import StableFallbackPanel from "../ui/StableFallbackPanel";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { useSiteData } from "../../hooks/useSiteData";
import { useVisitorStats } from "../../hooks/useVisitorStats";
import {
  buildStatusReport,
  downloadBlob,
  reportToHtml,
  reportToJson,
  type StatusReportSection,
} from "../../lib/build-status-report";

function statusVariant(status?: string): "synced" | "warn" | "danger" | "neutral" {
  if (status === "ok") return "synced";
  if (status === "warn") return "warn";
  if (status === "danger") return "danger";
  return "neutral";
}

function ReportSection({ section }: { section: StatusReportSection }) {
  return (
    <section className="report-section">
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4 pb-2 border-b border-[var(--color-border)]">
        {section.title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm report-table">
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <th className="pb-3 pr-4 font-medium w-[35%]">Record</th>
              <th className="pb-3 pr-4 font-medium">Value</th>
              <th className="pb-3 font-medium w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {section.rows.map((row) => (
              <tr key={`${section.title}-${row.label}`} className="hover:bg-white/[0.02]">
                <td className="py-3 pr-4 text-[var(--color-muted)]">{row.label}</td>
                <td className="py-3 pr-4 text-[var(--color-text)] font-[family-name:var(--font-mono)] text-xs sm:text-sm break-words">
                  {row.value}
                </td>
                <td className="py-3">
                  {row.status ? (
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  ) : (
                    <span className="text-[var(--color-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Reports() {
  const { data, error, loading } = useSiteData();
  const { stats: visitors } = useVisitorStats(data?.visitors);

  const report = useMemo(() => {
    if (!data) return null;
    return buildStatusReport(data, visitors);
  }, [data, visitors]);

  const stamp = useMemo(() => {
    if (!report) return "report";
    return new Date(report.generatedAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  }, [report]);

  const handlePrint = () => window.print();

  const handleSaveJson = () => {
    if (!report) return;
    downloadBlob(`lorapok-status-report-${stamp}.json`, reportToJson(report), "application/json");
  };

  const handleSaveHtml = () => {
    if (!report) return;
    downloadBlob(`lorapok-status-report-${stamp}.html`, reportToHtml(report), "text/html");
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <ShimmerSkeleton className="h-16" />
        <ShimmerSkeleton className="h-96" />
      </div>
    );
  }

  if (error || !data || !report) {
    return <ErrorState message={error ?? "Unable to build status report"} />;
  }

  const sections = [
    report.summary,
    report.marketplace,
    report.downloads,
    report.engagement,
    report.stableFallback,
    report.notice,
  ].filter(Boolean) as StatusReportSection[];

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Status Report"
        description="Professional record report for marketplace sync, downloads, engagement, and development notices."
        action={
          <div className="flex flex-wrap gap-2 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent-2)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Printer size={16} aria-hidden="true" />
              Print
            </button>
            <button
              type="button"
              onClick={handleSaveHtml}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-white/[0.04] transition-colors"
            >
              <FileText size={16} aria-hidden="true" />
              Save HTML
            </button>
            <button
              type="button"
              onClick={handleSaveJson}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-white/[0.04] transition-colors"
            >
              <Download size={16} aria-hidden="true" />
              Save JSON
            </button>
          </div>
        }
      />

      <Card className="report-document print-area">
        <header className="report-header mb-8 pb-6 border-b border-[var(--color-border)]">
          <p className="text-xs uppercase tracking-widest text-[var(--color-neon)] mb-2">{report.organization}</p>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">{report.reportTitle}</h1>
          <p className="text-sm text-[var(--color-muted)]">{report.product}</p>
          <p className="text-xs text-[var(--color-muted)] mt-3 font-[family-name:var(--font-mono)]">
            Generated {new Date(report.generatedAt).toLocaleString()} · Site data{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </header>

        <div className="space-y-10">
          {sections.map((section) => (
            <ReportSection key={section.title} section={section} />
          ))}
        </div>

        <footer className="report-footer mt-10 pt-6 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
          Lorapok Labs · Cursor Curse Monitor Admin · Confidential internal record
        </footer>
      </Card>

      {data.stableFallback && (
        <div className="no-print">
          <StableFallbackPanel info={data.stableFallback} />
        </div>
      )}
    </div>
  );
}
