import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Stack } from "@/shared/ui/primitives";

type TextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function TextField({ label, description, error, prefix, suffix, className, id, ...props }: TextFieldProps) {
  const inputId = id ?? (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <Stack gap="xs">
      <label htmlFor={inputId} className="font-medium text-[color:var(--ifx-text-primary)] text-sm">
        {label}
      </label>
      {description ? <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{description}</p> : null}
      <div className={cn("flex min-h-10 items-center gap-2 rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-3 shadow-[var(--ifx-shadow-sm)] transition focus-within:border-[color:var(--ifx-border-focus)] focus-within:ring-2 focus-within:ring-violet-500/15", error && "border-rose-500/50 ring-2 ring-rose-500/10") }>
        {prefix ? <span className="text-[color:var(--ifx-text-tertiary)]">{prefix}</span> : null}
        <input
          id={inputId}
          className={cn("min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[color:var(--ifx-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60", className)}
          {...props}
        />
        {suffix ? <span className="text-[color:var(--ifx-text-tertiary)]">{suffix}</span> : null}
      </div>
      {error ? <p className="text-rose-600 text-xs leading-5 dark:text-rose-300">{error}</p> : null}
    </Stack>
  );
}
