import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";

export type RagSourceType = "Initiative" | "project" | "task" | "document" | "comment" | "decision" | "system_event";

export type RagCitation = {
  citation_key: string;
  source_type: RagSourceType;
  source_id: number;
  title: string;
  excerpt: string;
  score: number;
  updated_at?: string | null;
  link: string;
};

export type RagAnswerRequest = {
  query: string;
  initiative_id?: number | null;
  project_id?: number | null;
  source_types?: RagSourceType[] | null;
  top_k?: number;
  include_excerpts?: boolean;
  max_context_chunks?: number;
  answer_style?: "concise" | "detailed" | "actionable";
};

export type RagAnswerResponse = {
  answer: string;
  citations: RagCitation[];
  confidence: number;
  missing_context: string[];
  follow_up_questions: string[];
  used_sources: string[];
  safety_flags: string[];
  permission_filtered_count: number;
  groundedness_score: number;
  latency_ms: number;
};

export type RagIndexStatusResponse = {
  indexed_chunks: number;
  queued_jobs: number;
  processing_jobs: number;
  failed_jobs: number;
  completed_jobs: number;
  last_indexed_at?: string | null;
  failed_samples: Array<{ id: number; entity_type: string; entity_id: number; error?: string | null }>;
};

export type RagReindexRequest = {
  initiative_id?: number | null;
  project_id?: number | null;
  entity_type?: RagSourceType | null;
  entity_id?: number | null;
  full_rebuild?: boolean;
  dry_run?: boolean;
};

export const useAskWorkspace = () => {
  return useMutation({
    mutationFn: async (payload: RagAnswerRequest) => {
      const response = await apiClient.post<RagAnswerResponse>("/rag/answer", payload);
      return response.data;
    },
  });
};

export const useRagIndexStatus = (enabled = true) => {
  return useQuery({
    queryKey: ["rag", "index-status"],
    queryFn: async () => {
      const response = await apiClient.get<RagIndexStatusResponse>("/rag/index-status");
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });
};

export const useReindexWorkspace = () => {
  return useMutation({
    mutationFn: async (payload: RagReindexRequest) => {
      const response = await apiClient.post("/rag/reindex", payload);
      return response.data as { queued_jobs: number; skipped_jobs: number; dry_run: boolean; message: string };
    },
  });
};
