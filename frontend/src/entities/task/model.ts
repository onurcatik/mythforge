export type TaskPriorityTone = "low" | "medium" | "high" | "urgent";
export type TaskRiskTone = "clear" | "watch" | "risk" | "critical";

export type TaskExecutionSignal = {
  id: string;
  title: string;
  priority: TaskPriorityTone;
  risk: TaskRiskTone;
  dueLabel?: string;
  assigneeLabel?: string;
  aiRecommendation?: string;
};
