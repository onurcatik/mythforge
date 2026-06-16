import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PremiumPageProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  heroClassName?: string;
};

export function PremiumPage({
  eyebrow,
  title,
  description,
  children,
  actions,
  className,
  heroClassName,
}: PremiumPageProps) {
  return (
    <div className={cn("premium-page space-y-6", className)}>
      <section className={cn("premium-hero overflow-hidden rounded-[2rem] border p-6 md:p-8", heroClassName)}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            {eyebrow ? (
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                {eyebrow}
              </Badge>
            ) : null}
            <h1 className="text-balance font-semibold text-3xl tracking-[-0.04em] md:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-muted-foreground text-sm leading-6 md:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </section>
      {children}
    </div>
  );
}

type SignalCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "ai";
  className?: string;
};

const toneClasses: Record<NonNullable<SignalCardProps["tone"]>, string> = {
  default: "from-slate-500/10 to-slate-500/0 text-foreground",
  success: "from-emerald-500/15 to-emerald-500/0 text-emerald-700 dark:text-emerald-300",
  warning: "from-amber-500/15 to-amber-500/0 text-amber-700 dark:text-amber-300",
  danger: "from-rose-500/15 to-rose-500/0 text-rose-700 dark:text-rose-300",
  ai: "from-violet-500/15 to-cyan-500/5 text-violet-700 dark:text-violet-300",
};

export function SignalCard({ icon: Icon, label, value, helper, tone = "default", className }: SignalCardProps) {
  return (
    <Card className={cn("premium-card group overflow-hidden", className)}>
      <CardContent className="relative p-5">
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-100", toneClasses[tone])} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">{label}</p>
            <div className="font-semibold text-2xl tracking-[-0.03em] text-foreground md:text-3xl">
              {value}
            </div>
            {helper ? <p className="text-muted-foreground text-xs leading-5">{helper}</p> : null}
          </div>
          <div className="rounded-2xl border bg-background/70 p-2 shadow-sm transition-transform group-hover:-translate-y-0.5">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type OperationCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: string;
  onClick?: () => void;
  className?: string;
};

export function OperationCard({ icon: Icon, title, description, cta = "Open", onClick, className }: OperationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "premium-card group relative w-full rounded-2xl border bg-card/90 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-medium text-sm">{title}</div>
          <p className="line-clamp-2 text-muted-foreground text-xs leading-5">{description}</p>
          <div className="pt-1 text-primary text-xs opacity-0 transition-opacity group-hover:opacity-100">
            {cta} →
          </div>
        </div>
      </div>
    </button>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">{eyebrow}</p> : null}
        <h2 className="font-semibold text-xl tracking-[-0.03em]">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/70 p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="font-medium">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm leading-6">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ApprovalPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 text-xs dark:text-amber-300">
      {children}
    </span>
  );
}

export function GhostButtonLink({ children, className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" className={cn("rounded-full bg-background/70", className)} {...props}>
      {children}
    </Button>
  );
}
