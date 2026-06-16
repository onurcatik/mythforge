import { AlertTriangle, GitBranch, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkGraphRiskMap } from "@/hooks/useWorkGraph";

const pct = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

type Props = {
  projectId: number;
  onOpenImpact: () => void;
};

export function WorkGraphProjectPanel({ projectId, onOpenImpact }: Props) {
  const risk = useWorkGraphRiskMap({ project_id: projectId, limit: 10 });
  const top = risk.data?.items ?? [];
  const maxRisk = top[0]?.score ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Network className="size-4" /> Work Graph Impact</CardTitle>
          <CardDescription>Critical path, blockers, blast radius and at-risk task map for this project.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenImpact}>Analyze task</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Max risk</div>
            <div className="mt-1 text-lg font-semibold">{pct(maxRisk)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk nodes</div>
            <div className="mt-1 text-lg font-semibold">{top.length}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Mode</div>
            <div className="mt-1 text-lg font-semibold">Permission-safe</div>
          </div>
        </div>
        {top.length > 0 ? (
          <div className="space-y-2">
            {top.slice(0, 5).map((item) => (
              <a key={item.node.id} href={item.node.link ?? undefined} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-2"><GitBranch className="size-4 text-muted-foreground" /><span className="truncate">{item.node.label}</span></span>
                <span className="ml-3 rounded-full bg-muted px-2 py-0.5 text-xs">{item.level} · {pct(item.score)}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" /> No graph risk data yet; run rebuild or open impact analysis on a task.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
