export type ProjectHealthTone = "healthy" | "watch" | "at_risk" | "blocked";

export type ProjectOperatingSignal = {
  id: string;
  label: string;
  value: string | number;
  helper?: string;
  tone: ProjectHealthTone;
};

export const projectHealthCopy: Record<ProjectHealthTone, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
  blocked: "Blocked",
};
