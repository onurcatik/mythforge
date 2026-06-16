import { extractSubPath } from "@/lib/guildUrl";

export type RouteProductArea = "operate" | "ai" | "govern";

export type RouteChromeContext = {
  activeId: string;
  eyebrow: string;
  title: string;
  description: string;
  productArea: RouteProductArea;
  primaryActionLabel?: string;
  primaryActionIntent?: "ai-command" | "create-task" | "create-document";
};

const routeContexts: Array<{ match: RegExp; context: RouteChromeContext }> = [
  {
    match: /^\/$/,
    context: {
      activeId: "dashboard",
      eyebrow: "Operating system",
      title: "Workspace command deck",
      description: "Health, risk, capacity and AI next actions for the active workspace.",
      productArea: "operate",
      primaryActionLabel: "Run AI command",
      primaryActionIntent: "ai-command",
    },
  },
  {
    match: /^\/projects(?:\/|$)/,
    context: {
      activeId: "projects",
      eyebrow: "Delivery",
      title: "Project cockpit",
      description: "Projects, timelines, blockers, documents and delivery signals.",
      productArea: "operate",
      primaryActionLabel: "Create task",
      primaryActionIntent: "create-task",
    },
  },
  {
    match: /^\/tasks(?:\/|$)/,
    context: {
      activeId: "tasks",
      eyebrow: "Execution",
      title: "Execution queue",
      description: "Prioritized work, assignees, dependencies, blockers and due dates.",
      productArea: "operate",
      primaryActionLabel: "Create task",
      primaryActionIntent: "create-task",
    },
  },
  {
    match: /^\/documents(?:\/|$)|^\/my-documents(?:\/|$)/,
    context: {
      activeId: "documents",
      eyebrow: "Knowledge",
      title: "Workspace documents",
      description: "Project knowledge, meeting notes, source history and RAG-ready context.",
      productArea: "operate",
      primaryActionLabel: "Create document",
      primaryActionIntent: "create-document",
    },
  },
  {
    match: /^\/settings(?:\/|$)|^\/profile(?:\/|$)/,
    context: {
      activeId: "settings",
      eyebrow: "Governance",
      title: "Workspace control plane",
      description: "Runtime, members, permissions, provider settings and audit-ready controls.",
      productArea: "govern",
      primaryActionLabel: "Test AI runtime",
      primaryActionIntent: "ai-command",
    },
  },
  {
    match: /^\/user-stats(?:\/|$)/,
    context: {
      activeId: "capacity",
      eyebrow: "Capacity",
      title: "Team capacity map",
      description: "Workload, delivery pressure, skill coverage and assignment readiness.",
      productArea: "ai",
      primaryActionLabel: "Suggest assignments",
      primaryActionIntent: "ai-command",
    },
  },
];

export const defaultRouteContext: RouteChromeContext = {
  activeId: "dashboard",
  eyebrow: "Workspace",
  title: "Mythforge AI",
  description: "AI-first project operations across tasks, documents, graph impact and local runtime.",
  productArea: "operate",
  primaryActionLabel: "Run AI command",
  primaryActionIntent: "ai-command",
};

export function normalizeRoutePath(pathname: string): string {
  const subPath = extractSubPath(pathname);
  return subPath || "/";
}

export function getRouteChromeContext(pathname: string): RouteChromeContext {
  const normalized = normalizeRoutePath(pathname);
  return routeContexts.find((entry) => entry.match.test(normalized))?.context ?? defaultRouteContext;
}

export function resolveWorkspaceHref(_activeGuildId: number | null, href: string): string {
  // Phase 2 intentionally keeps navigation route contracts stable. Existing list
  // routes derive guild scope from the active X-Guild-ID header, while entity
  // detail routes remain generated elsewhere with explicit IDs.
  return href;
}
