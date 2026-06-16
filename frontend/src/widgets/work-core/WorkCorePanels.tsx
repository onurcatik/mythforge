import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  GitCompareArrows,
  LayoutGrid,
  ListChecks,
  Network,
  PanelRight,
  Sparkles,
  Table2,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";

import { OperationCard, SectionHeader, SignalCard } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModeButtonProps = {
  active: boolean;
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
};

function ModeButton({ active, icon: Icon, children, onClick }: ModeButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="rounded-full"
      onClick={onClick}
    >
      <Icon className="size-4" />
      {children}
    </Button>
  );
}

function MiniSignal({ label, value, helper, tone = "default" }: { label: string; value: ReactNode; helper?: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "ai" }) {
  const toneClass = {
    default: "border-border bg-card/80",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    ai: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 font-semibold text-2xl tracking-[-0.04em]">{value}</div>
      {helper ? <div className="mt-1 text-xs leading-5 opacity-80">{helper}</div> : null}
    </div>
  );
}

type ProjectLike = {
  id: number;
  name: string;
  is_archived?: boolean | null;
  my_permission_level?: string | null;
  documents?: unknown[] | null;
  updated_at?: string | null;
};

type ProjectOperatingCockpitProps = {
  project: ProjectLike;
  statusCount: number;
  documentsCount: number;
  canWriteProject: boolean;
  canCreateDocuments: boolean;
  onCleanup: () => void;
  onReorder: () => void;
  onAssign: () => void;
  onDocsToPlan: () => void;
  onImpact: () => void;
};

export function ProjectOperatingCockpit({
  project,
  statusCount,
  documentsCount,
  canWriteProject,
  canCreateDocuments,
  onCleanup,
  onReorder,
  onAssign,
  onDocsToPlan,
  onImpact,
}: ProjectOperatingCockpitProps) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SignalCard icon={CheckCircle2} label="Delivery state" value={project.is_archived ? "Archived" : "Active"} helper="Project execution status" tone={project.is_archived ? "warning" : "success"} />
        <SignalCard icon={ListChecks} label="Workflow lanes" value={statusCount} helper="Configured task statuses" tone="default" />
        <SignalCard icon={FileText} label="Knowledge assets" value={documentsCount} helper="Attached docs and decisions" tone="ai" />
        <SignalCard icon={UserCheck} label="Write access" value={canWriteProject ? "Enabled" : "Read-only"} helper={project.my_permission_level ?? "permission inherited"} tone={canWriteProject ? "success" : "warning"} />
      </div>

      <div className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
        <SectionHeader
          eyebrow="Phase 4 cockpit"
          title="Project operating room"
          description="A single delivery cockpit for tasks, documents, ownership, blockers and AI-approved changes."
          action={<Badge variant="outline">Independent frontend</Badge>}
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <OperationCard icon={Sparkles} title="Cleanup plan" description="Detect stale work, unclear deadlines and duplicate paths." cta="Plan" onClick={onCleanup} />
          <OperationCard icon={GitCompareArrows} title="Reorder work" description="Preview a safer task order by dependency and risk pressure." cta="Diff" onClick={onReorder} />
          <OperationCard icon={UserCheck} title="Smart assign" description="Recommend owners by capacity, skills and timezone fit." cta="Score" onClick={onAssign} />
          <OperationCard icon={FileText} title="Docs to plan" description={canCreateDocuments ? "Convert notes and decisions into approved work." : "Read knowledge assets without changing project data."} cta="Convert" onClick={onDocsToPlan} />
          <OperationCard icon={Network} title="Impact map" description="Ask what breaks if this project or a critical task slips." cta="Analyze" onClick={onImpact} />
        </div>
      </div>
    </section>
  );
}

type TaskLike = {
  id: number;
  title: string;
  due_date?: string | null;
  assignees?: unknown[] | null;
  priority?: string | null;
};

type TaskExecutionCockpitProps = {
  totalCount: number;
  tasks: TaskLike[];
  overdue: number;
  dueSoon: number;
  assigned: number;
  viewMode: "table" | "calendar";
  onViewModeChange: (mode: "table" | "calendar") => void;
  onAiReorder: () => void;
  onCreateTask: () => void;
};

export function TaskExecutionCockpit({
  totalCount,
  tasks,
  overdue,
  dueSoon,
  assigned,
  viewMode,
  onViewModeChange,
  onAiReorder,
  onCreateTask,
}: TaskExecutionCockpitProps) {
  const unassigned = Math.max(0, tasks.length - assigned);
  const urgent = tasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;

  return (
    <section className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Execution queue"
          title="Priority operating lanes"
          description="A focused queue for what needs action, what is slipping and what AI should reorder next."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" onClick={onAiReorder}>
            <Bot className="size-4" />
            AI reorder
          </Button>
          <Button variant="outline" className="rounded-full" onClick={onCreateTask}>
            <ListChecks className="size-4" />
            New task
          </Button>
          <ModeButton active={viewMode === "table"} icon={Table2} onClick={() => onViewModeChange("table")}>Table</ModeButton>
          <ModeButton active={viewMode === "calendar"} icon={CalendarClock} onClick={() => onViewModeChange("calendar")}>Calendar</ModeButton>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MiniSignal label="Total workload" value={totalCount} helper="All filtered tasks" tone="ai" />
        <MiniSignal label="Visible now" value={tasks.length} helper="Current queue density" />
        <MiniSignal label="Overdue" value={overdue} helper={`${dueSoon} due soon`} tone={overdue > 0 ? "danger" : "success"} />
        <MiniSignal label="Unassigned" value={unassigned} helper={`${assigned} already assigned`} tone={unassigned > 0 ? "warning" : "success"} />
        <MiniSignal label="High priority" value={urgent} helper="Urgent/high priority" tone={urgent > 0 ? "warning" : "default"} />
      </div>
    </section>
  );
}

type TaskDetailOperatingRoomProps = {
  title: string;
  statusLabel: string;
  priority: string;
  assigneeCount: number;
  hasDueDate: boolean;
  isReadOnly: boolean;
  aiEnabled: boolean;
  onAiDescription: () => void;
  onOpenCommand: () => void;
  onSave: () => void;
  isSaving: boolean;
};

export function TaskDetailOperatingRoom({
  title,
  statusLabel,
  priority,
  assigneeCount,
  hasDueDate,
  isReadOnly,
  aiEnabled,
  onAiDescription,
  onOpenCommand,
  onSave,
  isSaving,
}: TaskDetailOperatingRoomProps) {
  return (
    <aside className="space-y-4">
      <div className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
        <SectionHeader
          eyebrow="Task operating room"
          title="Execution context"
          description="Metadata, AI actions and ownership signals stay visible while the task form remains unchanged."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MiniSignal label="Status" value={statusLabel} helper="Current workflow lane" tone="ai" />
          <MiniSignal label="Priority" value={priority} helper="Execution pressure" tone={priority === "urgent" || priority === "high" ? "warning" : "default"} />
          <MiniSignal label="Owners" value={assigneeCount} helper="Assigned operators" tone={assigneeCount > 0 ? "success" : "warning"} />
          <MiniSignal label="Deadline" value={hasDueDate ? "Set" : "Open"} helper="Scheduling signal" tone={hasDueDate ? "success" : "warning"} />
        </div>
      </div>

      <div className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
        <SectionHeader eyebrow="AI actions" title="Safe task operations" description="AI can draft, explain or plan; writes still require explicit approval." />
        <div className="mt-4 space-y-2">
          <Button className="w-full justify-start rounded-2xl" disabled={!aiEnabled || isReadOnly} onClick={onAiDescription}>
            <Sparkles className="size-4" />
            Generate stronger description
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl" onClick={onOpenCommand}>
            <Bot className="size-4" />
            Ask AI about this task
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl" disabled={isReadOnly || isSaving} onClick={onSave}>
            <CheckCircle2 className="size-4" />
            Save operating changes
          </Button>
        </div>
        <p className="mt-4 text-muted-foreground text-xs leading-5">
          {isReadOnly ? "This task is permission-protected or archived." : `Editing ${title} with approval-first AI boundaries.`}
        </p>
      </div>
    </aside>
  );
}

type DocumentKnowledgeCockpitProps = {
  totalCount: number;
  visibleCount: number;
  selectedCount: number;
  viewMode: "grid" | "list" | "tags";
  canCreate: boolean;
  onCreate: () => void;
  onAskWorkspace: () => void;
  onExtractPlan: () => void;
  onViewModeChange: (mode: "grid" | "list" | "tags") => void;
};

export function DocumentKnowledgeCockpit({
  totalCount,
  visibleCount,
  selectedCount,
  viewMode,
  canCreate,
  onCreate,
  onAskWorkspace,
  onExtractPlan,
  onViewModeChange,
}: DocumentKnowledgeCockpitProps) {
  return (
    <section className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Knowledge ops"
          title="Workspace memory control"
          description="Documents become sourceable knowledge for RAG answers, planning, meeting notes and task extraction."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" onClick={onAskWorkspace}>
            <Bot className="size-4" />
            Ask docs
          </Button>
          <Button variant="outline" className="rounded-full" onClick={onExtractPlan}>
            <Sparkles className="size-4" />
            Extract plan
          </Button>
          <Button variant="outline" className="rounded-full" disabled={!canCreate} onClick={onCreate}>
            <FileText className="size-4" />
            New doc
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MiniSignal label="Indexed surface" value={totalCount} helper="Total filtered documents" tone="ai" />
        <MiniSignal label="Visible" value={visibleCount} helper="Current page results" />
        <MiniSignal label="Selected" value={selectedCount} helper="Bulk operation scope" tone={selectedCount > 0 ? "warning" : "default"} />
        <MiniSignal label="RAG ready" value="Sourceable" helper="Citations and summaries" tone="success" />
        <div className="rounded-2xl border bg-background/60 p-3">
          <div className="mb-2 text-muted-foreground text-[11px] uppercase tracking-[0.18em]">View mode</div>
          <div className="flex flex-wrap gap-2">
            <ModeButton active={viewMode === "tags"} icon={PanelRight} onClick={() => onViewModeChange("tags")}>Tags</ModeButton>
            <ModeButton active={viewMode === "grid"} icon={LayoutGrid} onClick={() => onViewModeChange("grid")}>Grid</ModeButton>
            <ModeButton active={viewMode === "list"} icon={Table2} onClick={() => onViewModeChange("list")}>List</ModeButton>
          </div>
        </div>
      </div>
    </section>
  );
}

type DocumentDetailKnowledgeRoomProps = {
  title: string;
  documentType: string;
  projectCount: number;
  commentCount: number;
  canEdit: boolean;
  isDirty: boolean;
  isAIEnabled: boolean;
  onOpenPanel: () => void;
  onSummarize: () => void;
  onAskCommand: () => void;
};

export function DocumentDetailKnowledgeRoom({
  title,
  documentType,
  projectCount,
  commentCount,
  canEdit,
  isDirty,
  isAIEnabled,
  onOpenPanel,
  onSummarize,
  onAskCommand,
}: DocumentDetailKnowledgeRoomProps) {
  return (
    <aside className="space-y-4">
      <div className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
        <SectionHeader eyebrow="Knowledge room" title="Document intelligence" description="Source, summarize and connect this document without hiding the editor." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MiniSignal label="Type" value={documentType} helper="Document surface" tone="ai" />
          <MiniSignal label="Attached projects" value={projectCount} helper="Delivery links" />
          <MiniSignal label="Comments" value={commentCount} helper="Discussion context" tone={commentCount > 0 ? "warning" : "default"} />
          <MiniSignal label="Save state" value={isDirty ? "Unsaved" : "Synced"} helper="Editor persistence" tone={isDirty ? "warning" : "success"} />
        </div>
      </div>
      <div className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
        <SectionHeader eyebrow="AI actions" title="Source-aware operations" description="Use RAG and Local AI without leaking permission-protected context." />
        <div className="mt-4 space-y-2">
          <Button className="w-full justify-start rounded-2xl" disabled={!isAIEnabled} onClick={onSummarize}>
            <Sparkles className="size-4" />
            Summarize document
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl" onClick={onAskCommand}>
            <Bot className="size-4" />
            Ask workspace about this
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl" onClick={onOpenPanel}>
            <PanelRight className="size-4" />
            Open comments / AI panel
          </Button>
        </div>
        <p className="mt-4 text-muted-foreground text-xs leading-5">
          {canEdit ? `${title} can be edited and indexed safely.` : "Read-only document; AI actions stay source-aware."}
        </p>
      </div>
    </aside>
  );
}
