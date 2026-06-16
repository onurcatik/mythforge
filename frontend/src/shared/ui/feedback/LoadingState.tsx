import { cn } from "@/shared/lib/cn";

export function LoadingBars({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      <div className="h-4 w-2/5 animate-pulse rounded-full bg-[color:var(--ifx-surface-muted)]" />
      <div className="h-24 animate-pulse rounded-[var(--ifx-radius-xl)] bg-[color:var(--ifx-surface-muted)]" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-[var(--ifx-radius-xl)] bg-[color:var(--ifx-surface-muted)]" />
        <div className="h-28 animate-pulse rounded-[var(--ifx-radius-xl)] bg-[color:var(--ifx-surface-muted)]" />
        <div className="h-28 animate-pulse rounded-[var(--ifx-radius-xl)] bg-[color:var(--ifx-surface-muted)]" />
      </div>
    </div>
  );
}
