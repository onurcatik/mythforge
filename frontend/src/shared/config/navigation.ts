import { Bot, BrainCircuit, FileText, FolderKanban, Gauge, GitBranch, Home, ListChecks, Settings, Sparkles, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  productArea: "operate" | "ai" | "govern";
};

export const primaryNavigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Operating dashboard",
    description: "Workspace health, risks, capacity and AI next actions.",
    href: "/",
    icon: Home,
    productArea: "operate",
  },
  {
    id: "projects",
    label: "Projects",
    description: "Delivery cockpit, tasks, docs and execution state.",
    href: "/projects",
    icon: FolderKanban,
    productArea: "operate",
  },
  {
    id: "tasks",
    label: "Execution queue",
    description: "Prioritized tasks, blockers, dependencies and assignments.",
    href: "/tasks",
    icon: ListChecks,
    productArea: "operate",
  },
  {
    id: "documents",
    label: "Knowledge base",
    description: "Documents, meeting notes, citations and workspace memory.",
    href: "/documents",
    icon: FileText,
    productArea: "operate",
  },
  {
    id: "command-center",
    label: "AI Command Center",
    description: "Ask, plan, assign, reorder and run approval-first actions.",
    href: "ai-command",
    icon: Sparkles,
    productArea: "ai",
  },
  {
    id: "work-graph",
    label: "Work Graph",
    description: "Impact analysis, critical paths and dependency health.",
    href: "ai-command",
    icon: GitBranch,
    productArea: "ai",
  },
  {
    id: "capacity",
    label: "Capacity map",
    description: "Workload, skill coverage and smart assignment readiness.",
    href: "/user-stats",
    icon: UsersRound,
    productArea: "ai",
  },
  {
    id: "runtime",
    label: "AI Runtime",
    description: "OpenAI, Anthropic, Ollama, local mode and model health.",
    href: "/settings/guild/ai",
    icon: BrainCircuit,
    productArea: "govern",
  },
  {
    id: "settings",
    label: "Workspace settings",
    description: "Members, permissions, AI policies and audit settings.",
    href: "/settings",
    icon: Settings,
    productArea: "govern",
  },
];

export const quickCommandTemplates = [
  "Summarize this project and show the next three actions",
  "Show the highest-risk tasks in this Initiative",
  "Turn these meeting notes into a plan",
  "Who should own this task and why?",
  "What breaks if this task slips by three days?",
] as const;

export const productSignalItems = [
  { label: "Workspace memory", value: "RAG", icon: Bot },
  { label: "Agent planning", value: "Approval-first", icon: Sparkles },
  { label: "Impact analysis", value: "Work Graph", icon: GitBranch },
  { label: "Capacity engine", value: "Smart assignment", icon: Gauge },
] as const;
