import { AlertTriangle, GitBranch, Loader2, Network, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "robot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkGraphHealth, useWorkGraphImpact, type WorkGraphNode, type WorkGraphNodeType } from "@/hooks/useWorkGraph";

const pct = (value?: number | null) => `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`;

const NodeCard = ({ node }: { node: WorkGraphNode }) => (
  <a href={node.link ?? undefined} className="block rounded-md border p-3 text-sm transition-colors hover:bg-muted/50">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{node.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {node.entity_type} · #{node.entity_id}{node.status ? ` · ${node.status}` : ""}{node.priority ? ` · ${node.priority}` : ""}
        </div>
      </div>
      {typeof node.score === "number" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{pct(node.score)}</span>}
    </div>
  </a>
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: WorkGraphNodeType;
  defaultEntityId?: number | null;
};

export function WorkGraphImpactDialog({ open, onOpenChange, defaultEntityType = "task", defaultEntityId = null }: Props) {
  const [entityType, setEntityType] = useState<WorkGraphNodeType>(defaultEntityType);
  const [entityId, setEntityId] = useState(defaultEntityId ? String(defaultEntityId) : "");
  const [direction, setDirection] = useState<"downstream" | "upstream" | "both">("downstream");
  const impact = useWorkGraphImpact();
  const health = useWorkGraphHealth(open);

  useEffect(() => {
    if (open) {
      setEntityType(defaultEntityType);
      setEntityId(defaultEntityId ? String(defaultEntityId) : "");
    }
  }, [open, defaultEntityType, defaultEntityId]);

  const entityIdNumber = Number(entityId);
  const canRun = Number.isFinite(entityIdNumber) && entityIdNumber > 0 && !impact.isPending;

  const run = () => {
    if (!canRun) return;
    impact.mutate(
      { entity_type: entityType, entity_id: entityIdNumber, direction, max_depth: 6 },
      { onError: () => toast.error("Work Graph impact analysis failed") }
    );
  };

  const data = impact.data;
  const topNodes = useMemo(() => data ? [...data.critical_path_impacted, ...data.directly_impacted].slice(0, 12) : [], [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="size-5" />
            Work Graph Impact
          </DialogTitle>
          <DialogDescription>
            Analyze downstream dependencies, blockers, deadlines, affected users and blast radius before a task slips.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              <span>
                {health.data ? `${health.data.nodes} nodes · ${health.data.edges} edges · ${health.data.open_blockers} open blockers` : "Permission-safe graph status loading..."}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_1fr_180px_auto]">
            <div className="space-y-1">
              <Label>Entity type</Label>
              <Select value={entityType} onValueChange={(value) => setEntityType(value as WorkGraphNodeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="blocker">Blocker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Entity ID</Label>
              <Input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="Task / project / document id" />
            </div>
            <div className="space-y-1">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(value) => setDirection(value as "downstream" | "upstream" | "both")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="downstream">Downstream</SelectItem>
                  <SelectItem value="upstream">Upstream</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={run} disabled={!canRun}>
                {impact.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Analyze
              </Button>
            </div>
          </div>

          {impact.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Impact analysis failed or the node is outside your permission scope.
            </div>
          )}

          {data && (
            <ScrollArea className="max-h-[56vh] rounded-md border">
              <div className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  {Object.entries(data.blast_radius).map(([key, value]) => (
                    <div key={key} className="rounded-md border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{key}</div>
                      <div className="mt-1 text-xl font-semibold">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> Recommended actions</div>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {data.recommended_actions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium"><GitBranch className="size-4" /> Critical / directly impacted nodes</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {topNodes.length === 0 ? <div className="text-sm text-muted-foreground">No downstream impact found.</div> : topNodes.map((node) => <NodeCard key={`${node.entity_type}-${node.entity_id}-${node.id}`} node={node} />)}
                  </div>
                </div>

                {data.at_risk_deadlines.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-medium">At-risk deadlines</div>
                    <div className="grid gap-2 md:grid-cols-2">{data.at_risk_deadlines.map((node) => <NodeCard key={`deadline-${node.id}`} node={node} />)}</div>
                  </div>
                )}

                {data.affected_users.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-medium">Affected users</div>
                    <div className="grid gap-2 md:grid-cols-2">{data.affected_users.map((node) => <NodeCard key={`user-${node.id}`} node={node} />)}</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
