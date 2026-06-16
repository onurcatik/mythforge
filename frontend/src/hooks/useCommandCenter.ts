import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type CommandIntent =
  | "ask_workspace"
  | "plan_project"
  | "summarize_project"
  | "show_risks"
  | "reorder_tasks"
  | "assign_tasks"
  | "impact_analysis"
  | "convert_meeting_notes"
  | "create_tasks"
  | "resolve_blockers"
  | "project_cleanup"
  | "open_entity";

export type CommandSessionStatus = "interpreted" | "running" | "awaiting_approval" | "completed" | "failed" | "rejected";

export type CommandContext = {
  initiative_id?: number | null;
  project_id?: number | null;
  entity_type?: string | null;
  entity_id?: number | null;
  route?: string | null;
  selected_filters?: Record<string, unknown>;
};

export type CommandSuggestedAction = {
  action_id: string;
  label: string;
  intent: CommandIntent;
  requires_approval: boolean;
  reason?: string | null;
};

export type CommandInterpretResponse = {
  intent: CommandIntent;
  confidence: number;
  required_context: Record<string, unknown>;
  suggested_actions: CommandSuggestedAction[];
  safety_flags: string[];
  execution_mode: "read_only" | "approval_required" | "navigation";
  message: string;
};

export type CommandResultCard = {
  title: string;
  description?: string | null;
  kind: string;
  score?: number | null;
  link?: string | null;
  metadata: Record<string, unknown>;
};

export type CommandSourceCard = {
  source_type: string;
  source_id?: number | null;
  title: string;
  excerpt?: string | null;
  link?: string | null;
  score?: number | null;
};

export type CommandResult = {
  type: "answer" | "agent_plan" | "risk_map" | "assignment" | "impact" | "cleanup" | "navigation" | "error";
  title: string;
  summary: string;
  cards: CommandResultCard[];
  sources: CommandSourceCard[];
  table: Array<Record<string, unknown>>;
  diff?: Record<string, unknown> | null;
  suggested_actions: CommandSuggestedAction[];
  approval_state: string;
  raw: Record<string, unknown>;
};

export type CommandExecuteResponse = {
  session_id: number;
  status: CommandSessionStatus;
  intent: CommandIntent;
  confidence: number;
  used_tools: string[];
  approval_state: string;
  latency_ms: number;
  result: CommandResult;
  safety_flags: string[];
};

export type CommandSessionRead = {
  id: number;
  intent: CommandIntent;
  status: CommandSessionStatus;
  confidence: number;
  command_preview: string;
  required_context: Record<string, unknown>;
  suggested_actions: Array<Record<string, unknown>>;
  safety_flags: string[];
  result: Record<string, unknown>;
  used_tools: string[];
  approval_state: string;
  latency_ms: number;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export const useInterpretCommand = () => {
  return useMutation({
    mutationFn: async (payload: { command: string; context?: CommandContext }) => {
      const response = await apiClient.post<CommandInterpretResponse>("/command/interpret", {
        command: payload.command,
        context: payload.context ?? {},
      });
      return response.data;
    },
  });
};

export const useExecuteCommand = () => {
  return useMutation({
    mutationFn: async (payload: { command: string; intent?: CommandIntent | null; context?: CommandContext; dry_run?: boolean }) => {
      const response = await apiClient.post<CommandExecuteResponse>("/command/execute", {
        command: payload.command,
        intent: payload.intent ?? null,
        context: payload.context ?? {},
        dry_run: payload.dry_run ?? false,
      });
      return response.data;
    },
  });
};

export const useCommandHistory = (enabled = true) => {
  return useQuery({
    queryKey: ["command", "history"],
    queryFn: async () => {
      const response = await apiClient.get<{ items: CommandSessionRead[] }>("/command/history", { params: { limit: 25 } });
      return response.data;
    },
    enabled,
    staleTime: 10_000,
  });
};

export const useCommandHealth = (enabled = true) => {
  return useQuery({
    queryKey: ["command", "health"],
    queryFn: async () => {
      const response = await apiClient.get<{ enabled: boolean; status: "ok" | "degraded"; supported_intents: CommandIntent[]; policy: Record<string, unknown> }>("/command/health");
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });
};
