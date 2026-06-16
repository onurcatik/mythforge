import { ChevronRight } from "lucide-react";

import { primaryNavigation } from "@/shared/config/navigation";
import { cn } from "@/shared/lib/cn";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack } from "@/shared/ui/primitives";

type IndependentNavigationProps = {
  activeId?: string;
  onNavigate?: (href: string) => void;
};

export function IndependentNavigation({ activeId = "dashboard", onNavigate }: IndependentNavigationProps) {
  return (
    <nav aria-label="Primary" className="space-y-6">
      {(["operate", "ai", "govern"] as const).map((area) => {
        const items = primaryNavigation.filter((item) => item.productArea === area);
        return (
          <Stack key={area} gap="sm">
            <div className="px-2 text-[color:var(--ifx-text-tertiary)] text-[0.68rem] uppercase tracking-[0.22em]">{area}</div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate?.(item.href)}
                    className={cn(
                      "group w-full rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-violet-500/20 bg-violet-500/10 text-[color:var(--ifx-text-primary)] shadow-[var(--ifx-shadow-sm)]"
                        : "border-transparent text-[color:var(--ifx-text-secondary)] hover:border-[color:var(--ifx-border-subtle)] hover:bg-[color:var(--ifx-surface-muted)] hover:text-[color:var(--ifx-text-primary)]"
                    )}
                  >
                    <Cluster className="flex-nowrap" gap="sm" justify="between">
                      <Cluster className="min-w-0 flex-nowrap" gap="sm">
                        <span className={cn("rounded-xl border p-2", active ? "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300" : "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)]") }>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-sm">{item.label}</span>
                          <span className="line-clamp-1 text-[color:var(--ifx-text-tertiary)] text-xs">{item.description}</span>
                        </span>
                      </Cluster>
                      {active ? <StatusBadge tone="ai">Live</StatusBadge> : <ChevronRight className="size-4 opacity-0 transition group-hover:opacity-60" />}
                    </Cluster>
                  </button>
                );
              })}
            </div>
          </Stack>
        );
      })}
    </nav>
  );
}
