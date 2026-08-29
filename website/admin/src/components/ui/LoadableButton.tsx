import type { ButtonHTMLAttributes, ReactNode } from "react";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";

type LoadableButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  /** Shown beside the larvae while loading (optional). */
  loadingLabel?: string;
  children: ReactNode;
};

/**
 * Primary action button with Lorapok Larvae loading state (replaces spinners on rounded CTAs).
 */
export default function LoadableButton({
  loading = false,
  loadingLabel,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: LoadableButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center gap-2 ${className} ${loading ? "pointer-events-none" : ""}`}
    >
      <span
        className={`inline-flex items-center justify-center gap-2 ${loading ? "opacity-0" : ""}`}
        aria-hidden={loading}
      >
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center gap-2 px-3">
          <LorapokLarvaeLoader size="xs" ariaLabel={loadingLabel ?? "Loading"} />
          {loadingLabel ? <span className="text-sm font-semibold whitespace-nowrap">{loadingLabel}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
