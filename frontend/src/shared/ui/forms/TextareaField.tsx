import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Stack } from "@/shared/ui/primitives";

type TextareaFieldProps = ComponentPropsWithoutRef<"textarea"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
};

export function TextareaField({ label, description, error, className, id, ...props }: TextareaFieldProps) {
  const textareaId = id ?? (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <Stack gap="xs">
      <label htmlFor={textareaId} className="font-medium text-[color:var(--ifx-text-primary)] text-sm">
        {label}
      </label>
      {description ? <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{description}</p> : null}
      <textarea
        id={textareaId}
        className={cn("min-h-28 rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-3 py-2 text-sm shadow-[var(--ifx-shadow-sm)] outline-none transition focus:border-[color:var(--ifx-border-focus)] focus:ring-2 focus:ring-violet-500/15 placeholder:text-[color:var(--ifx-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60", error && "border-rose-500/50 ring-2 ring-rose-500/10", className)}
        {...props}
      />
      {error ? <p className="text-rose-600 text-xs leading-5 dark:text-rose-300">{error}</p> : null}
    </Stack>
  );
}
