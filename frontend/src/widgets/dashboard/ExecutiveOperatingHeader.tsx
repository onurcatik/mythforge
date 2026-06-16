import { Bot, CheckCircle2, ListTodo, ScrollText, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, PageHeader, Stack } from "@/shared/ui/primitives";

export type ExecutiveOperatingHeaderProps = {
  workspaceName: ReactNode;
  projectHref: string;
  docsHref: string;
  healthScore: number;
  localMode?: boolean;
};

export function ExecutiveOperatingHeader({ workspaceName, projectHref, docsHref, healthScore, localMode }: ExecutiveOperatingHeaderProps) {
  return (
    <PageHeader
      eyebrow="AI-first project operating system"
      title={
        <>
          {workspaceName} <span className="ai-gradient-text">mission control</span>
        </>
      }
      description="A premium operations dashboard that turns workspace memory, agent planning, Work Graph impact and smart assignment into concrete daily decisions."
      actions={
        <Stack gap="sm" className="w-full min-w-[min(22rem,100%)] sm:w-auto">
          <Cluster gap="xs" justify="end">
            <StatusBadge tone={healthScore >= 80 ? "success" : healthScore >= 60 ? "warning" : "danger"} dot>
              {healthScore}% health
            </StatusBadge>
            <StatusBadge tone={localMode ? "ai" : "info"}>
              <ShieldCheck className="mr-1 size-3" />{localMode ? "Local Ollama" : "Runtime ready"}
            </StatusBadge>
          </Cluster>
          <Cluster gap="xs" justify="end">
            <Button
              className="rounded-full"
              onClick={() =>
                getOpenAICommandCenter()?.(
                  "Bu workspace için riskleri göster, görevleri yeniden sırala, blockerları çıkar ve bugün uygulanacak operasyon planını öner."
                )
              }
            >
              <Bot className="size-4" />
              Run operating plan
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-background/70">
              <Link to={projectHref}>
                <ListTodo className="size-4" />
                Projects
              </Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to={docsHref}>
                <ScrollText className="size-4" />
                Docs
              </Link>
            </Button>
          </Cluster>
        </Stack>
      }
      className="overflow-hidden"
    />
  );
}

export function DashboardTrustStrip() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
        <Cluster gap="sm" className="flex-nowrap">
          <CheckCircle2 className="size-5 text-emerald-500" />
          <div>
            <div className="font-medium text-sm">Approval-first AI</div>
            <p className="text-[color:var(--ifx-text-secondary)] text-xs">Write actions remain previewed, diffed and auditable.</p>
          </div>
        </Cluster>
      </div>
      <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
        <Cluster gap="sm" className="flex-nowrap">
          <ShieldCheck className="size-5 text-violet-500" />
          <div>
            <div className="font-medium text-sm">Permission-safe context</div>
            <p className="text-[color:var(--ifx-text-secondary)] text-xs">RAG, graph and assignment respect backend authorization.</p>
          </div>
        </Cluster>
      </div>
      <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
        <Cluster gap="sm" className="flex-nowrap">
          <Bot className="size-5 text-cyan-500" />
          <div>
            <div className="font-medium text-sm">Local-first capable</div>
            <p className="text-[color:var(--ifx-text-secondary)] text-xs">Ollama runtime can keep sensitive work on-device.</p>
          </div>
        </Cluster>
      </div>
    </div>
  );
}
