import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { statusToneClasses, type StatusTone } from "@/shared/design-system";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
};

export function StatusBadge({ children, tone = "neutral", dot = false, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-[0.72rem] leading-none", statusToneClasses[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
