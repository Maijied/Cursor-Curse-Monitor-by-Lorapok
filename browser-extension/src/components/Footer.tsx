import React from "react";
import { formatAlsoAvailableOn } from "@lorapok/cursor-monitor-shared";

declare const __EXTENSION_VERSION__: string;

type Props = {
  onFeedbackClick?: () => void;
};

export function Footer({ onFeedbackClick }: Props) {
  return (
    <footer className="ext-footer">
      <p className="ext-footer-crosslink">{formatAlsoAvailableOn("browser")}</p>
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
        <a href="mailto:cursor.monitor@lorapok.tech">Updates</a>
        <span className="version">v{__EXTENSION_VERSION__}</span>
      </p>
    </footer>
  );
}
