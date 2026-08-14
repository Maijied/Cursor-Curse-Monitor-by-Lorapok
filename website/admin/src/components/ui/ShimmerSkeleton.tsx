export default function ShimmerSkeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`rounded-2xl shimmer ${className}`} aria-hidden="true" />;
}
