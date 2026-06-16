export const designTokens = {
  color: {
    surface: {
      canvas: "var(--ifx-surface-canvas)",
      raised: "var(--ifx-surface-raised)",
      overlay: "var(--ifx-surface-overlay)",
      glass: "var(--ifx-surface-glass)",
    },
    text: {
      primary: "var(--ifx-text-primary)",
      secondary: "var(--ifx-text-secondary)",
      tertiary: "var(--ifx-text-tertiary)",
      inverse: "var(--ifx-text-inverse)",
    },
    border: {
      subtle: "var(--ifx-border-subtle)",
      strong: "var(--ifx-border-strong)",
      focus: "var(--ifx-border-focus)",
    },
    intent: {
      ai: "var(--ifx-intent-ai)",
      success: "var(--ifx-intent-success)",
      warning: "var(--ifx-intent-warning)",
      danger: "var(--ifx-intent-danger)",
      info: "var(--ifx-intent-info)",
    },
  },
  space: {
    0: "0px",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
  },
  radius: {
    sm: "var(--ifx-radius-sm)",
    md: "var(--ifx-radius-md)",
    lg: "var(--ifx-radius-lg)",
    xl: "var(--ifx-radius-xl)",
    pill: "999px",
  },
  shadow: {
    sm: "var(--ifx-shadow-sm)",
    md: "var(--ifx-shadow-md)",
    lg: "var(--ifx-shadow-lg)",
    ai: "var(--ifx-shadow-ai)",
  },
  type: {
    display: "var(--ifx-font-display)",
    body: "var(--ifx-font-body)",
    mono: "var(--ifx-font-mono)",
  },
} as const;

export type DesignTokens = typeof designTokens;

export const densityScale = {
  compact: {
    controlHeight: "2rem",
    rowHeight: "2.5rem",
    pagePadding: "1rem",
  },
  comfortable: {
    controlHeight: "2.5rem",
    rowHeight: "3rem",
    pagePadding: "1.5rem",
  },
  spacious: {
    controlHeight: "2.75rem",
    rowHeight: "3.5rem",
    pagePadding: "2rem",
  },
} as const;

export type DensityMode = keyof typeof densityScale;
