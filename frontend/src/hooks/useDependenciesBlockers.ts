import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type TaskDependency = {
  id: number;
  source_task_id: number;
  target_task_id: number;
  lag_minutes: number;
  project_id?: number | null;
  initiative_id?: number | null;
  created_at: string;
};

export type TaskBlocker = {
  id: number;
  task_id: number;
  title: string;
  reason?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "ignored";
  owner_user_id?: number | null;
  project_id?: number | null;
  initiative_id?: number | null;
  linked_entity_type?: string | null;
  linked_entity_id?: number | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export const useTaskDependencies = (taskId?: number | null, enabled = true) => {
  return useQuery({
    queryKey: ["dependencies", "task", taskId],
    queryFn: async () => {
      const response = await apiClient.get<{ items: TaskDependency[]; total: number }>("/dependencies", { params: { task_id: taskId } });
      return response.data;
    },
    enabled: enabled && !!taskId,
    staleTime: 20_000,
  });
};

export const useCreateDependency = () => {
  return useMutation({
    mutationFn: async (payload: { source_task_id: number; target_task_id: number; lag_minutes?: number }) => {
      const response = await apiClient.post<TaskDependency>("/dependencies", payload);
      return response.data;
    },
  });
};

export const useDeleteDependency = () => {
  return useMutation({
    mutationFn: async (dependencyId: number) => {
      const response = await apiClient.delete<TaskDependency>(`/dependencies/${dependencyId}`);
      return response.data;
    },
  });
};

export const useTaskBlockers = (taskId?: number | null, enabled = true) => {
  return useQuery({
    queryKey: ["blockers", "task", taskId],
    queryFn: async () => {
      const response = await apiClient.get<{ items: TaskBlocker[]; total: number }>(`/blockers/task/${taskId}`);
      return response.data;
    },
    enabled: enabled && !!taskId,
    staleTime: 20_000,
  });
};

export const useCreateBlocker = () => {
  return useMutation({
    mutationFn: async (payload: { task_id: number; title: string; reason?: string | null; severity?: "low" | "medium" | "high" | "critical"; owner_user_id?: number | null }) => {
      const response = await apiClient.post<TaskBlocker>("/blockers", payload);
      return response.data;
    },
  });
};

export const useResolveBlocker = () => {
  return useMutation({
    mutationFn: async (payload: { blocker_id: number; resolution_note?: string | null }) => {
      const response = await apiClient.post<TaskBlocker>(`/blockers/${payload.blocker_id}/resolve`, { resolution_note: payload.resolution_note });
      return response.data;
    },
  });
};
