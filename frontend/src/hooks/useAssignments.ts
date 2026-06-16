import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type AssignmentMode = "recommend" | "auto" | "approval_required";
export type AssignmentStatus = "draft" | "ready" | "approved" | "applied" | "rejected" | "expired" | "superseded" | "failed";

export type AssignmentRecommendation = {
  id?: number | null;
  task_id: number;
  recommended_user_id: number;
  recommended_user_name?: string | null;
  score: number;
  confidence: number;
  mode: AssignmentMode;
  status: AssignmentStatus;
  reasoning: string;
  score_breakdown: Record<string, unknown>;
  policy_decision: string;
  created_at?: string | null;
  applied_at?: string | null;
  rejected_at?: string | null;
};

export type AssignmentRecommendResponse = {
  recommendation: AssignmentRecommendation | null;
  candidates: AssignmentRecommendation[];
  policy: Record<string, unknown>;
  graph_impact: Record<string, unknown>;
};

export type AssignmentCapacityItem = {
  user_id: number;
  user_name?: string | null;
  active_task_count: number;
  overdue_task_count: number;
  blocker_owner_count: number;
  deadline_pressure_count: number;
  estimated_effort_minutes: number;
  timezone: string;
  role: string;
  calculated_at?: string | null;
};

export const useRecommendAssignment = () => {
  return useMutation({
    mutationFn: async (payload: { task_id: number; auto_apply?: boolean; force_refresh?: boolean; confidence_threshold?: number }) => {
      const response = await apiClient.post<AssignmentRecommendResponse>("/assignments/recommend", payload);
      return response.data;
    },
  });
};

export const useApplyAssignment = () => {
  return useMutation({
    mutationFn: async (payload: { recommendation_id: number; require_approval_override?: boolean }) => {
      const response = await apiClient.post<{ applied: boolean; task_id: number; assignee_id?: number | null; recommendation_id: number; status: AssignmentStatus; message: string; requires_approval: boolean }>("/assignments/apply", payload);
      return response.data;
    },
  });
};

export const useRejectAssignment = () => {
  return useMutation({
    mutationFn: async (payload: { recommendation_id: number; reason?: string | null }) => {
      const response = await apiClient.post<AssignmentRecommendation>("/assignments/reject", payload);
      return response.data;
    },
  });
};

export const useTaskAssignments = (taskId?: number | null, enabled = true) => {
  return useQuery({
    queryKey: ["assignments", "task", taskId],
    queryFn: async () => {
      const response = await apiClient.get<AssignmentRecommendation[]>(`/assignments/task/${taskId}`);
      return response.data;
    },
    enabled: enabled && !!taskId,
    staleTime: 15_000,
  });
};

export const useAssignmentCapacity = (enabled = true) => {
  return useQuery({
    queryKey: ["assignments", "capacity"],
    queryFn: async () => {
      const response = await apiClient.get<{ items: AssignmentCapacityItem[]; generated_at: string }>("/assignments/capacity");
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });
};
