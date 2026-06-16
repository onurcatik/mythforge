export const clampPercent = (value?: number | null) => `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`;

export const compactNumber = (value?: number | null) => {
  const safe = Number.isFinite(value ?? NaN) ? Number(value) : 0;
  if (Math.abs(safe) >= 1000) return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(safe);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(safe);
};

export const shortJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
};
