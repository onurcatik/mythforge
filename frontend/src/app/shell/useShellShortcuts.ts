import { useEffect } from "react";

type ShellShortcuts = {
  onOpenCommand?: () => void;
  onOpenAI?: () => void;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

export function useShellShortcuts({ onOpenCommand, onOpenAI }: ShellShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        onOpenCommand?.();
      }
      if (key === "j") {
        event.preventDefault();
        onOpenAI?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenAI, onOpenCommand]);
}
