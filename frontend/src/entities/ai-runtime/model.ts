export type RuntimeProvider = "openai" | "anthropic" | "ollama" | "custom";
export type RuntimeMode = "cloud" | "local" | "hybrid";

export type RuntimeHealth = {
  provider: RuntimeProvider;
  mode: RuntimeMode;
  label: string;
  isHealthy: boolean;
  latencyMs?: number | null;
  chatModel?: string | null;
  embeddingModel?: string | null;
  localOnly?: boolean;
  lastCheckedAt?: string | null;
};

export const providerLabel: Record<RuntimeProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
  custom: "Custom endpoint",
};
