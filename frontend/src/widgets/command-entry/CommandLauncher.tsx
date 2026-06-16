import { Command, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { quickCommandTemplates } from "@/shared/config/navigation";
import { KbdHint } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type CommandLauncherProps = {
  title?: ReactNode;
  description?: ReactNode;
  onLaunch?: (prompt?: string) => void;
};

export function CommandLauncher({ title = "Run the workspace", description = "Ask, plan, assign, analyze risk and convert notes into approved work.", onLaunch }: CommandLauncherProps) {
  return (
    <Surface id="ifx-command-entry" tone="ai" padding="lg" className="overflow-hidden">
      <Stack gap="lg">
        <Cluster justify="between" align="start" gap="lg">
          <Stack gap="sm" className="max-w-2xl">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 font-medium text-violet-700 text-xs dark:text-violet-300">
              <Sparkles className="size-3.5" /> AI Command Center
            </div>
            <div>
              <h2 className="font-semibold text-2xl tracking-[-0.04em] md:text-3xl">{title}</h2>
              <p className="mt-2 text-[color:var(--ifx-text-secondary)] text-sm leading-6">{description}</p>
            </div>
          </Stack>
          <button
            type="button"
            onClick={() => onLaunch?.()}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-3 py-2 font-medium text-sm shadow-[var(--ifx-shadow-sm)] transition hover:-translate-y-0.5 hover:border-violet-500/30"
          >
            <Command className="size-4" />
            Open
            <KbdHint>⌘K</KbdHint>
          </button>
        </Cluster>
        <div className="grid gap-2 md:grid-cols-2">
          {quickCommandTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => onLaunch?.(template)}
              className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-glass)] px-4 py-3 text-left text-[color:var(--ifx-text-secondary)] text-sm transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:text-[color:var(--ifx-text-primary)]"
            >
              {template}
            </button>
          ))}
        </div>
      </Stack>
    </Surface>
  );
}
