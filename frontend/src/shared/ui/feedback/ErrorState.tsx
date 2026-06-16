import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type ErrorStateProps = {
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

export function ErrorState({ title = "Something needs attention", description, action }: ErrorStateProps) {
  return (
    <Surface tone="danger" padding="lg">
      <Cluster align="start" gap="md">
        <div className="rounded-2xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-300">
          <AlertTriangle className="size-5" />
        </div>
        <Stack gap="xs" className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">{description}</p>
          {action ? <div className="pt-2">{action}</div> : null}
        </Stack>
      </Cluster>
    </Surface>
  );
}
