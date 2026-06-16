import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type AgentSessionStatus = "planning" | "awaiting_approval" | "approved" | "executing" | "completed" | "failed" | "rejected" | "rolled_back";
export type AgentStepStatus = "proposed" | "approved" | "rejected" | "executing" | "executed" | "failed" | "rolled_back" | "skipped";
export type AgentStepAction = "create_initiative" | "create_project" | "create_task" | "create_subtask" | "assign_user" | "set_deadline" | "add_dependency" | "update_entity" | "archive_entity";

export type AgentPlanStep = {
  id: number;
  step_order: number;
  action: AgentStepAction;
  status: AgentStepStatus;
  entity_type: string;
  entity_id?: number | null;
  title: string;
  summary: string;
  rationale: string;
  proposed_patch: Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  diff: Record<string, unknown>;
  requires_approval: boolean;
  project_id?: number | null;
  initiative_id?: number | null;
  result?: Record<string, unknown>;
  error?: string | null;
};

export type AgentPlanResponse = {
  session_id: number;
  status: AgentSessionStatus;
  plan_version: number;
  goal: string;
  normalized_goal: string;
  assumptions: string[];
  project_patches: Record<string, unknown>[];
  task_patches: Record<string, unknown>[];
  subtask_patches: Record<string, unknown>[];
  dependencies: Record<string, unknown>[];
  risks: Array<{ severity: "low" | "medium" | "high"; title: string; mitigation: string }>;
  required_approvals: string[];
  diff_summary: string;
  confidence: number;
  context_summary: Array<Record<string, unknown>>;
  steps: AgentPlanStep[];
};

export type AgentExecuteResponse = {
  session_id: number;
  status: AgentSessionStatus;
  executed: Array<{ step_id: number; action: AgentStepAction; status: AgentStepStatus; entity_type: string; entity_id?: number | null; link?: string | null; error?: string | null }>;
  skipped: Array<{ step_id: number; action: AgentStepAction; status: AgentStepStatus; entity_type: string; entity_id?: number | null; error?: string | null }>;
  rollback_available: boolean;
};

export const useCreateAgentPlan = () => {
  return useMutation({
    mutationFn: async (payload: { goal: string; initiative_id?: number | null; project_id?: number | null; max_steps?: number }) => {
      const response = await apiClient.post<AgentPlanResponse>("/agent/plan", payload);
      return response.data;
    },
  });
};

export const useApproveAgentPlan = () => {
  return useMutation({
    mutationFn: async (payload: { session_id: number; step_ids?: number[] | null; expected_plan_version: number; decision?: "approve" | "reject"; reason?: string | null }) => {
      const response = await apiClient.post("/agent/approve", { decision: "approve", ...payload });
      return response.data as { session_id: number; status: AgentSessionStatus; approved_step_ids: number[]; rejected_step_ids: number[]; plan_version: number };
    },
  });
};

export const useExecuteAgentPlan = () => {
  return useMutation({
    mutationFn: async (payload: { session_id: number; step_ids?: number[] | null; expected_plan_version: number }) => {
      const response = await apiClient.post<AgentExecuteResponse>("/agent/execute", payload);
      return response.data;
    },
  });
};

export const useRejectAgentPlan = () => {
  return useMutation({
    mutationFn: async (payload: { session_id: number; expected_plan_version: number; reason?: string | null }) => {
      const response = await apiClient.post("/agent/reject", payload);
      return response.data as { session_id: number; status: AgentSessionStatus; rejected_step_ids: number[]; plan_version: number };
    },
  });
};

export const useRollbackAgentPlan = () => {
  return useMutation({
    mutationFn: async (payload: { session_id: number; step_ids?: number[] | null; reason?: string | null }) => {
      const response = await apiClient.post("/agent/rollback", payload);
      return response.data as { session_id: number; status: AgentSessionStatus; rolled_back_step_ids: number[]; failed_step_ids: number[] };
    },
  });
};

export const useAgentSession = (sessionId?: number | null, enabled = true) => {
  return useQuery({
    queryKey: ["agent", "session", sessionId],
    queryFn: async () => {
      const response = await apiClient.get<AgentPlanResponse>(`/agent/sessions/${sessionId}`);
      return response.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: 10_000,
  });
};
