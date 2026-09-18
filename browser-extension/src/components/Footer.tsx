import React from "react";
import {
  DISCORD_INVITE_URL,
  GITHUB_CONTRIBUTING_URL,
  CONTRIBUTE_CTA_LABEL,
  getPlatformAvailabilityStrip,
} from "@lorapok/cursor-monitor-shared";

declare const __EXTENSION_VERSION__: string;

type Props = {
  onFeedbackClick?: () => void;
};

export function Footer({ onFeedbackClick }: Props) {
  const platforms = getPlatformAvailabilityStrip("browser");

  return (
    <footer className="ext-footer">
      <nav className="ext-footer-platforms" aria-label="Platform availability">
        {platforms.map((item, index) => (
          <span key={item.id}>
            {index > 0 ? <span className="sep" aria-hidden="true">·</span> : null}
            <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.label}>
              {item.shortLabel}
            </a>
          </span>
        ))}
      </nav>
      <p className="ext-footer-meta">
        <span>It&apos;s a product of</span>{" "}
        <a href="https://lorapok.tech" target="_blank" rel="noopener noreferrer">
          Lorapok Labs
        </a>
        <span className="sep">·</span>
        {onFeedbackClick ? (
          <>
            <button type="button" className="ext-footer-link" onClick={onFeedbackClick}>
              Feedback
            </button>
            <span className="sep">·</span>
          </>
        ) : null}
        <a href="mailto:cursor.curse.help@lorapok.tech">Help</a>
        <span className="sep">·</span>
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
          Discord
        </a>
        <span className="sep">·</span>
        <a href={GITHUB_CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer">
          {CONTRIBUTE_CTA_LABEL}
        </a>
        <span className="sep">·</span>
        <a href="mailto:cursor.monitor@lorapok.tech">Updates</a>
        <span className="version">v{__EXTENSION_VERSION__}</span>
      </p>
    </footer>
  );
}
