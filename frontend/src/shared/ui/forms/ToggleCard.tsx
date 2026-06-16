import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Cluster, Stack } from "@/shared/ui/primitives";

type ToggleCardProps = {
  title: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onChange?: (checked: boolean) => void;
};

export function ToggleCard({ title, description, checked = false, disabled = false, icon, onChange }: ToggleCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "w-full rounded-[var(--ifx-radius-xl)] border p-4 text-left shadow-[var(--ifx-shadow-sm)] transition",
        checked ? "border-violet-500/30 bg-violet-500/10" : "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] hover:border-[color:var(--ifx-border-focus)]",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <Cluster className="flex-nowrap" justify="between" align="start">
        <Cluster className="min-w-0 flex-nowrap" gap="sm" align="start">
          {icon ? <span className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-2">{icon}</span> : null}
          <Stack gap="xs" className="min-w-0">
            <span className="font-medium text-sm">{title}</span>
            {description ? <span className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{description}</span> : null}
          </Stack>
        </Cluster>
        <span className={cn("relative inline-flex h-6 w-10 rounded-full border p-0.5 transition", checked ? "border-violet-500/40 bg-violet-500" : "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)]")}>
          <span className={cn("size-4 rounded-full bg-white shadow transition", checked && "translate-x-4")} />
        </span>
      </Cluster>
    </button>
  );
}
