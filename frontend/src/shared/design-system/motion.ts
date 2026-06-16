export const motionTokens = {
  duration: {
    instant: 80,
    fast: 140,
    base: 220,
    slow: 360,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
  transition: {
    interactive: "transform 160ms cubic-bezier(0.2, 0, 0, 1), border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
    page: "opacity 220ms cubic-bezier(0.2, 0, 0, 1), transform 220ms cubic-bezier(0.2, 0, 0, 1)",
  },
} as const;
