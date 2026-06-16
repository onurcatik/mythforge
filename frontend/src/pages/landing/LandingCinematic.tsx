import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";

import "./home-page.css";
import {
  ArchitectureTrustSection,
  AssignmentSection,
  CommandOutcomeSection,
  FinalCtaSection,
  GovernanceSection,
  HeroSection,
  IntelligenceModulesSection,
  LandingFooter,
  LandingNav,
  LocalRuntimeSection,
  OperatingSystemSection,
  ScenarioSection,
  TechnicalQualitySection,
  UseCasesSection,
  WorkGraphSection,
  WorkspaceMemorySection,
} from "./home-page-sections";

export const LandingCinematic = () => {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState<boolean | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && token) {
      void router.navigate({ to: "/tasks", replace: true });
    }
  }, [token, loading, router]);

  useEffect(() => {
    const fetchBootstrapStatus = async () => {
      try {
        const response = await apiClient.get<{
          has_users: boolean;
          public_registration_enabled: boolean;
        }>("/auth/bootstrap");
        setPublicRegistrationEnabled(response.data.public_registration_enabled);
      } catch {
        setPublicRegistrationEnabled(true);
      }
    };

    void fetchBootstrapStatus();
  }, []);

  const handleScroll = useCallback(() => {
    setNavSolid(window.scrollY > 48);
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="home-os-page">
      <LandingNav
        mobileOpen={mobileOpen}
        navSolid={navSolid}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
        publicRegistrationEnabled={publicRegistrationEnabled}
      />
      <main id="home-os-main" tabIndex={-1}>
        <HeroSection publicRegistrationEnabled={publicRegistrationEnabled} />
        <OperatingSystemSection />
        <IntelligenceModulesSection />
        <CommandOutcomeSection />
        <WorkspaceMemorySection />
        <WorkGraphSection />
        <AssignmentSection />
        <LocalRuntimeSection />
        <GovernanceSection />
        <UseCasesSection />
        <ScenarioSection />
        <ArchitectureTrustSection />
        <TechnicalQualitySection />
        <FinalCtaSection publicRegistrationEnabled={publicRegistrationEnabled} />
      </main>
      <LandingFooter />
    </div>
  );
};
