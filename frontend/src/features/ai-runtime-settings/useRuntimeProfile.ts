import { useCallback, useEffect, useMemo, useState } from "react";

import type { AIProvider } from "@/api/generated/initiativeAPI.schemas";
import {
  type RuntimeAdvancedProfile,
  DEFAULT_ADVANCED_PROFILE,
  getRuntimeStorageKey,
  normalizeAdvancedProfile,
} from "./providerMetadata";

const parseProfile = (raw: string | null): RuntimeAdvancedProfile => {
  if (!raw) return DEFAULT_ADVANCED_PROFILE;
  try {
    const parsed = JSON.parse(raw) as Partial<RuntimeAdvancedProfile>;
    return normalizeAdvancedProfile("", "", parsed);
  } catch {
    return DEFAULT_ADVANCED_PROFILE;
  }
};

export const useRuntimeProfile = (scope: string, scopeId?: number | string | null) => {
  const storageKey = useMemo(() => getRuntimeStorageKey(scope, scopeId), [scope, scopeId]);
  const [profile, setProfileState] = useState<RuntimeAdvancedProfile>(() => parseProfile(null));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setProfileState(parseProfile(window.localStorage.getItem(storageKey)));
  }, [storageKey]);

  const setProfile = useCallback(
    (updater: RuntimeAdvancedProfile | ((prev: RuntimeAdvancedProfile) => RuntimeAdvancedProfile)) => {
      setProfileState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [storageKey]
  );

  const normalizeForProvider = useCallback(
    (provider: AIProvider | "", model: string) => {
      setProfile((prev) => normalizeAdvancedProfile(provider, model, prev));
    },
    [setProfile]
  );

  return { profile, setProfile, normalizeForProvider, storageKey };
};
