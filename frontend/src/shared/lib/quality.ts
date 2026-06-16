export type QualityTone = "success" | "warning" | "danger" | "neutral";

export type QualitySignal = {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: QualityTone;
};

export type QualityChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: "ready" | "watch" | "blocked";
  owner: "frontend" | "backend-contract" | "qa" | "design-system";
};

export function getQualityTone(score: number): QualityTone {
  if (score >= 90) return "success";
  if (score >= 75) return "warning";
  if (score > 0) return "danger";
  return "neutral";
}

export function calculateReadinessScore(items: QualityChecklistItem[]): number {
  if (items.length === 0) return 0;
  const weighted = items.reduce((score, item) => {
    if (item.status === "ready") return score + 1;
    if (item.status === "watch") return score + 0.55;
    return score;
  }, 0);

  return Math.round((weighted / items.length) * 100);
}

export function getPhaseEightChecklist(): QualityChecklistItem[] {
  return [
    {
      id: "responsive-shell",
      title: "Responsive shell verified",
      description: "Desktop, laptop, tablet and mobile layouts keep navigation, command entry and core actions usable.",
      status: "ready",
      owner: "frontend",
    },
    {
      id: "a11y-foundation",
      title: "Accessibility foundation active",
      description: "Skip links, focus rings, semantic regions, reduced-motion handling and route-level error recovery are present.",
      status: "ready",
      owner: "design-system",
    },
    {
      id: "backend-contract",
      title: "Backend contract unchanged",
      description: "Phase 8 keeps API payloads, auth, permissions, RLS, RAG, Agent, Work Graph and Assignment contracts intact.",
      status: "ready",
      owner: "backend-contract",
    },
    {
      id: "quality-gates",
      title: "Quality gates documented",
      description: "Build, typecheck, lint, smoke, responsive and accessibility commands are consolidated for final QA.",
      status: "ready",
      owner: "qa",
    },
    {
      id: "dependency-runtime",
      title: "Runtime dependency check required",
      description: "Full typecheck and build still require installing frontend dependencies in the real environment.",
      status: "watch",
      owner: "qa",
    },
  ];
}

export function getQualitySignals(): QualitySignal[] {
  return [
    {
      id: "independence",
      label: "Frontend independence",
      value: "8/8 phases",
      helper: "New shell, dashboard, work surfaces, AI operations, graph, assignment and runtime UX are isolated from backend changes.",
      tone: "success",
    },
    {
      id: "backend-touch",
      label: "Backend changes",
      value: "0 files",
      helper: "Phase 8 is a frontend-only quality hardening pass.",
      tone: "success",
    },
    {
      id: "qa-status",
      label: "QA closure",
      value: "Ready for install",
      helper: "Run pnpm install, pnpm typecheck and pnpm build in the real frontend environment.",
      tone: "warning",
    },
  ];
}
