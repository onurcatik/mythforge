import type { ReactNode } from "react";
import { useEffect } from "react";

import type { DensityMode } from "@/shared/design-system";

type DesignSystemProviderProps = {
  children: ReactNode;
  density?: DensityMode;
  brand?: "linear" | "vercel" | "raycast" | "neutral";
};

export function DesignSystemProvider({ children, density = "comfortable", brand = "linear" }: DesignSystemProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ifxDensity = density;
    root.dataset.ifxBrand = brand;
    return () => {
      delete root.dataset.ifxDensity;
      delete root.dataset.ifxBrand;
    };
  }, [density, brand]);

  return <>{children}</>;
}
