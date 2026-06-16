import type { AIProvider } from "@/api/generated/initiativeAPI.schemas";

export type RuntimeMode = "cloud" | "local" | "hybrid";

export type RuntimeAdvancedProfile = {
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  embeddingModel: string;
  localOnly: boolean;
  hybridFallback: boolean;
  streaming: boolean;
  jsonMode: boolean;
  timeoutSeconds: number;
  customChatPath: string;
  customEmbeddingPath: string;
  customAuthHeaderName: string;
};

export const DEFAULT_ADVANCED_PROFILE: RuntimeAdvancedProfile = {
  temperature: 0.2,
  maxTokens: 4096,
  contextWindow: 8192,
  embeddingModel: "",
  localOnly: false,
  hybridFallback: false,
  streaming: true,
  jsonMode: true,
  timeoutSeconds: 60,
  customChatPath: "/v1/chat/completions",
  customEmbeddingPath: "/v1/embeddings",
  customAuthHeaderName: "Authorization",
};

export type ProviderCapability =
  | "Cloud"
  | "Local"
  | "Private"
  | "Streaming"
  | "JSON"
  | "Embeddings"
  | "Agent-ready"
  | "Custom";

export const PROVIDER_CAPABILITIES: Record<AIProvider, ProviderCapability[]> = {
  openai: ["Cloud", "Streaming", "JSON", "Embeddings", "Agent-ready"],
  anthropic: ["Cloud", "Streaming", "JSON", "Agent-ready"],
  ollama: ["Local", "Private", "Streaming", "JSON", "Embeddings", "Agent-ready"],
  custom: ["Custom", "Cloud", "Streaming", "JSON", "Embeddings"],
};

export const PROVIDER_RUNTIME_COPY: Record<AIProvider, { title: string; description: string; risk: string }> = {
  openai: {
    title: "OpenAI cloud runtime",
    description: "Best for high-quality RAG answers, structured output and reliable agent planning.",
    risk: "Workspace context may be sent to a cloud provider when this runtime is active.",
  },
  anthropic: {
    title: "Anthropic cloud runtime",
    description: "Strong for planning, long-form reasoning and safe assistant behavior.",
    risk: "Embeddings need a separate provider; verify RAG embedding configuration before enabling.",
  },
  ollama: {
    title: "Ollama local runtime",
    description: "Run chat, RAG and embeddings on a local or self-hosted Ollama instance.",
    risk: "Local-only mode blocks cloud fallback and requires local model availability.",
  },
  custom: {
    title: "Custom OpenAI-compatible runtime",
    description: "Connect an internal gateway or third-party OpenAI-compatible endpoint.",
    risk: "Validate endpoint ownership, auth headers and SSRF policy before use.",
  },
};

export const getRuntimeMode = (provider: AIProvider | "", profile: RuntimeAdvancedProfile): RuntimeMode => {
  if (profile.hybridFallback) return "hybrid";
  if (provider === "ollama" || profile.localOnly) return "local";
  return "cloud";
};

export const getRuntimeStorageKey = (scope: string, scopeId?: number | string | null) =>
  `Initiative:ai-runtime:${scope}:${scopeId ?? "default"}`;

export const normalizeAdvancedProfile = (
  provider: AIProvider | "",
  model: string,
  current?: Partial<RuntimeAdvancedProfile>
): RuntimeAdvancedProfile => {
  const base = { ...DEFAULT_ADVANCED_PROFILE, ...current };
  const embeddingModel =
    base.embeddingModel || (provider === "ollama" ? "nomic-embed-text" : provider === "openai" ? "text-embedding-3-small" : "");

  return {
    ...base,
    embeddingModel,
    localOnly: provider === "ollama" ? base.localOnly : false,
    hybridFallback: provider === "ollama" ? base.hybridFallback : false,
    contextWindow: Number.isFinite(base.contextWindow) ? base.contextWindow : 8192,
    maxTokens: Number.isFinite(base.maxTokens) ? base.maxTokens : 4096,
    temperature: Number.isFinite(base.temperature) ? base.temperature : 0.2,
    timeoutSeconds: Number.isFinite(base.timeoutSeconds) ? base.timeoutSeconds : 60,
    jsonMode: provider === "anthropic" ? false : base.jsonMode,
    streaming: base.streaming,
  };
};

export const getModelInstallHint = (provider: AIProvider | "", model?: string) => {
  if (provider !== "ollama" || !model) return null;
  return `ollama pull ${model}`;
};
