export const clamp01 = (value: number | null | undefined) => Math.max(0, Math.min(1, Number(value ?? 0)));

export const percent = (value: number | null | undefined) => `${Math.round(clamp01(value) * 100)}%`;

export const hours = (minutes: number | null | undefined) => `${Math.round(Number(minutes ?? 0) / 60)}h`;

export const riskTone = (score: number | null | undefined) => {
  const value = clamp01(score);
  if (value >= 0.8) return "critical" as const;
  if (value >= 0.6) return "high" as const;
  if (value >= 0.35) return "medium" as const;
  return "low" as const;
};

export const toneClass = (tone: "low" | "medium" | "high" | "critical" | "neutral" | "ai") =>
  ({
    low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    medium: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    high: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    critical: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    neutral: "border-border bg-card/80 text-foreground",
    ai: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  })[tone];
