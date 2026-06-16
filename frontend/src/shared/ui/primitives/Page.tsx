import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Cluster, Stack } from "./Layout";

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <section className={cn("ifx-page-hero rounded-[var(--ifx-radius-2xl)] border p-5 md:p-8", className)}>
      <Cluster justify="between" align="end" gap="lg" className="relative z-10">
        <Stack gap="sm" className="max-w-3xl">
          {eyebrow ? <div className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.22em]">{eyebrow}</div> : null}
          <h1 className="text-balance font-semibold text-3xl tracking-[-0.045em] md:text-5xl">{title}</h1>
          {description ? <p className="max-w-2xl text-[color:var(--ifx-text-secondary)] text-sm leading-6 md:text-base">{description}</p> : null}
        </Stack>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </Cluster>
    </section>
  );
}

type PageFrameProps = {
  children: ReactNode;
  className?: string;
};

export function PageFrame({ children, className }: PageFrameProps) {
  return <main className={cn("ifx-page-frame mx-auto w-full max-w-[1560px] px-4 py-4 md:px-6 md:py-6", className)}>{children}</main>;
}
