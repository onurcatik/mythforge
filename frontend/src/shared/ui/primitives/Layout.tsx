import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type StackProps = ComponentPropsWithoutRef<"div"> & {
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  children: ReactNode;
};

const gapClass = {
  xs: "gap-1.5",
  sm: "gap-2.5",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

export function Stack({ gap = "md", className, children, ...props }: StackProps) {
  return (
    <div className={cn("flex flex-col", gapClass[gap], className)} {...props}>
      {children}
    </div>
  );
}

type ClusterProps = ComponentPropsWithoutRef<"div"> & {
  gap?: StackProps["gap"];
  align?: "start" | "center" | "end";
  justify?: "start" | "between" | "end" | "center";
  children: ReactNode;
};

const alignClass = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
} as const;

const justifyClass = {
  start: "justify-start",
  between: "justify-between",
  end: "justify-end",
  center: "justify-center",
} as const;

export function Cluster({ gap = "md", align = "center", justify = "start", className, children, ...props }: ClusterProps) {
  return (
    <div className={cn("flex flex-wrap", gapClass[gap], alignClass[align], justifyClass[justify], className)} {...props}>
      {children}
    </div>
  );
}

type GridProps = ComponentPropsWithoutRef<"div"> & {
  variant?: "cards" | "metrics" | "split";
  children: ReactNode;
};

const gridClass = {
  cards: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
  metrics: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
  split: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]",
} as const;

export function ResponsiveGrid({ variant = "cards", className, children, ...props }: GridProps) {
  return (
    <div className={cn(gridClass[variant], className)} {...props}>
      {children}
    </div>
  );
}
