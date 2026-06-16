import { CheckCircle2, GitCompareArrows, ShieldCheck, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { StatusBadge } from "./StatusBadge";

type ActionPreviewCardProps = {
  title: ReactNode;
  description?: ReactNode;
  actionType?: "create" | "update" | "assign" | "delete" | "approve";
  approvalRequired?: boolean;
  before?: ReactNode;
  after?: ReactNode;
};

const actionTone = {
  create: "success",
  update: "info",
  assign: "ai",
  delete: "danger",
  approve: "warning",
} as const;

export function ActionPreviewCard({ title, description, actionType = "update", approvalRequired = true, before, after }: ActionPreviewCardProps) {
  return (
    <Surface tone="glass" padding="md">
      <Stack gap="md">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <Cluster gap="xs">
              <StatusBadge tone={actionTone[actionType]}>{actionType}</StatusBadge>
              {approvalRequired ? <StatusBadge tone="warning"><ShieldCheck className="mr-1 size-3" />Approval required</StatusBadge> : null}
            </Cluster>
            <h3 className="font-semibold tracking-[-0.02em]">{title}</h3>
            {description ? <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">{description}</p> : null}
          </Stack>
          <GitCompareArrows className="size-5 text-[color:var(--ifx-text-tertiary)]" />
        </Cluster>
        {(before || after) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
              <Cluster gap="xs" className="mb-2 text-rose-700 text-xs dark:text-rose-300"><XCircle className="size-3.5" />Before</Cluster>
              <div className="text-sm">{before ?? "No previous state"}</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <Cluster gap="xs" className="mb-2 text-emerald-700 text-xs dark:text-emerald-300"><CheckCircle2 className="size-3.5" />After</Cluster>
              <div className="text-sm">{after ?? "No proposed state"}</div>
            </div>
          </div>
        ) : null}
      </Stack>
    </Surface>
  );
}
