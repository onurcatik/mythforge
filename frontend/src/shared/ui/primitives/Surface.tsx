import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type SurfaceTone = "default" | "muted" | "glass" | "ai" | "danger";
type SurfacePadding = "none" | "sm" | "md" | "lg";

type SurfaceProps = {
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  interactive?: boolean;
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"section">;

const toneClass: Record<SurfaceTone, string> = {
  default: "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] text-[color:var(--ifx-text-primary)]",
  muted: "border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] text-[color:var(--ifx-text-primary)]",
  glass: "ifx-glass-panel border-[color:var(--ifx-border-subtle)] text-[color:var(--ifx-text-primary)]",
  ai: "ifx-ai-panel border-violet-500/20 text-[color:var(--ifx-text-primary)]",
  danger: "border-rose-500/20 bg-rose-500/10 text-[color:var(--ifx-text-primary)]",
};

const paddingClass: Record<SurfacePadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-7",
};

export function Surface({
  tone = "default",
  padding = "md",
  interactive = false,
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--ifx-radius-xl)] border shadow-[var(--ifx-shadow-sm)]",
        "transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out",
        toneClass[tone],
        paddingClass[padding],
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:border-[color:var(--ifx-border-focus)] hover:shadow-[var(--ifx-shadow-md)]",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
