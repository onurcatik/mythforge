import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type WorkGraphNodeType =
  | "Initiative"
  | "project"
  | "task"
  | "subtask"
  | "document"
  | "comment"
  | "user"
  | "deadline"
  | "dependency"
  | "blocker"
  | "skill"
  | "deliverable"
  | "milestone"
  | "agent_step";

export type WorkGraphNode = {
  id: number;
  entity_type: WorkGraphNodeType;
  entity_id: number;
  label: string;
  status?: string | null;
  priority?: string | null;
  owner_user_id?: number | null;
  deadline_at?: string | null;
  project_id?: number | null;
  initiative_id?: number | null;
  score?: number | null;
  link?: string | null;
  metadata: Record<string, unknown>;
};

export type WorkGraphImpactResponse = {
  run_id?: number | null;
  start_node: WorkGraphNode;
  directly_impacted: WorkGraphNode[];
  indirectly_impacted: WorkGraphNode[];
  critical_path_impacted: WorkGraphNode[];
  blocked_by: WorkGraphNode[];
  blocking: WorkGraphNode[];
  at_risk_deadlines: WorkGraphNode[];
  affected_deliverables: WorkGraphNode[];
  affected_users: WorkGraphNode[];
  blast_radius: Record<string, number>;
  cycles: number[][];
  confidence: number;
  recommended_actions: string[];
  latency_ms: number;
};

export type WorkGraphRiskMapResponse = {
  items: Array<{ node: WorkGraphNode; score: number; level: "low" | "medium" | "high" | "critical"; factors: Record<string, unknown> }>;
  by_project: Record<string, number>;
  by_assignee: Record<string, number>;
  by_deadline: Record<string, number>;
  by_blocker: Record<string, number>;
};

export type WorkGraphHealthResponse = {
  enabled: boolean;
  status: "ok" | "degraded";
  nodes: number;
  edges: number;
  open_blockers: number;
  dependencies: number;
  policy: Record<string, unknown>;
};

export const useWorkGraphImpact = () => {
  return useMutation({
    mutationFn: async (payload: { entity_type: WorkGraphNodeType; entity_id: number; direction?: "downstream" | "upstream" | "both"; max_depth?: number }) => {
      const response = await apiClient.post<WorkGraphImpactResponse>("/work-graph/impact", payload);
      return response.data;
    },
  });
};

export const useWorkGraphRiskMap = (params?: { initiative_id?: number | null; project_id?: number | null; limit?: number }, enabled = true) => {
  return useQuery({
    queryKey: ["work-graph", "risk-map", params],
    queryFn: async () => {
      const response = await apiClient.get<WorkGraphRiskMapResponse>("/work-graph/risk-map", { params });
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });
};

export const useWorkGraphHealth = (enabled = true) => {
  return useQuery({
    queryKey: ["work-graph", "health"],
    queryFn: async () => {
      const response = await apiClient.get<WorkGraphHealthResponse>("/work-graph/health");
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });
};

export const useRebuildWorkGraph = () => {
  return useMutation({
    mutationFn: async (payload: { initiative_id?: number | null; project_id?: number | null; dry_run?: boolean }) => {
      const response = await apiClient.post<{ nodes_synced: number; edges_synced: number; message: string }>("/work-graph/rebuild", payload);
      return response.data;
    },
  });
};
