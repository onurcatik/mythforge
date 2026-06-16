import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type KbdHintProps = {
  children: ReactNode;
  className?: string;
};

export function KbdHint({ children, className }: KbdHintProps) {
  return (
    <kbd className={cn("inline-flex min-w-6 items-center justify-center rounded-md border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-1.5 py-0.5 font-medium font-mono text-[0.68rem] text-[color:var(--ifx-text-secondary)] shadow-[var(--ifx-shadow-sm)]", className)}>
      {children}
    </kbd>
  );
}
