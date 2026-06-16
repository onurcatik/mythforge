import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { statusToneClasses, type StatusTone } from "@/shared/design-system";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type MetricCardProps = {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
  tone?: StatusTone;
  className?: string;
};

export function MetricCard({ icon: Icon, label, value, helper, trend, tone = "neutral", className }: MetricCardProps) {
  return (
    <Surface className={cn("overflow-hidden", className)} padding="md">
      <Cluster justify="between" align="start" gap="md">
        <Stack gap="xs">
          <div className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.18em]">{label}</div>
          <div className="font-semibold text-2xl tracking-[-0.04em] md:text-3xl">{value}</div>
          {helper ? <div className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{helper}</div> : null}
        </Stack>
        <div className={cn("rounded-2xl border p-2", statusToneClasses[tone])}>
          <Icon className="size-5" />
        </div>
      </Cluster>
      {trend ? <div className="mt-4 border-[color:var(--ifx-border-subtle)] border-t pt-3 text-[color:var(--ifx-text-secondary)] text-xs">{trend}</div> : null}
    </Surface>
  );
}
