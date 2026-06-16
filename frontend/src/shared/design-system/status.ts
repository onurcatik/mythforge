export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "ai";

export const statusToneClasses: Record<StatusTone, string> = {
  neutral: "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] text-[color:var(--ifx-text-secondary)]",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  ai: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export const riskToneByScore = (score?: number): StatusTone => {
  if (score == null) return "neutral";
  if (score >= 80) return "danger";
  if (score >= 55) return "warning";
  if (score >= 25) return "info";
  return "success";
};
