import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Cluster, Stack } from "@/shared/ui/primitives";

type EmptyStateProps = {
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Stack className={cn("items-center justify-center rounded-[var(--ifx-radius-xl)] border border-dashed border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] px-6 py-12 text-center", className)} gap="md">
      <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-3 text-[color:var(--ifx-text-secondary)] shadow-[var(--ifx-shadow-sm)]">
        <Icon className="size-6" />
      </div>
      <Stack gap="xs" className="max-w-md">
        <h3 className="font-semibold text-lg tracking-[-0.02em]">{title}</h3>
        <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">{description}</p>
      </Stack>
      {action ? <Cluster justify="center">{action}</Cluster> : null}
    </Stack>
  );
}
