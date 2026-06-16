import { ExternalLink, FileText } from "lucide-react";
import type { ReactNode } from "react";

import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { StatusBadge } from "./StatusBadge";

type SourceCardProps = {
  title: ReactNode;
  excerpt?: ReactNode;
  sourceType?: string;
  confidence?: number;
  href?: string;
};

export function SourceCard({ title, excerpt, sourceType = "source", confidence, href }: SourceCardProps) {
  return (
    <Surface padding="sm" tone="glass" className="rounded-2xl">
      <Cluster gap="sm" align="start" className="flex-nowrap">
        <div className="rounded-xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-2 text-[color:var(--ifx-text-secondary)]">
          <FileText className="size-4" />
        </div>
        <Stack gap="xs" className="min-w-0 flex-1">
          <Cluster gap="xs">
            <StatusBadge tone="neutral">{sourceType}</StatusBadge>
            {typeof confidence === "number" ? <StatusBadge tone={confidence >= 0.75 ? "success" : "warning"}>{Math.round(confidence * 100)}%</StatusBadge> : null}
          </Cluster>
          <div className="line-clamp-1 font-medium text-sm">{title}</div>
          {excerpt ? <p className="line-clamp-2 text-[color:var(--ifx-text-secondary)] text-xs leading-5">{excerpt}</p> : null}
        </Stack>
        {href ? (
          <a className="rounded-lg p-2 text-[color:var(--ifx-text-tertiary)] hover:bg-[color:var(--ifx-surface-muted)] hover:text-[color:var(--ifx-text-primary)]" href={href}>
            <ExternalLink className="size-4" />
          </a>
        ) : null}
      </Cluster>
    </Surface>
  );
}
