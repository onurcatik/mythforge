import { Sparkles } from "lucide-react";

import { RuntimeCapabilityCard } from "@/widgets/ai-runtime";
import { CommandLauncher } from "@/widgets/command-entry";
import { OperatingSignalGrid } from "@/widgets/overview";
import { OnboardingProgressCard } from "@/processes/onboarding";
import { PageFrame, PageHeader, ResponsiveGrid, Stack } from "@/shared/ui/primitives";
import { StatusBadge } from "@/shared/ui/data-display";

export function PhaseOneShowcase() {
  return (
    <PageFrame>
      <Stack gap="lg">
        <PageHeader
          eyebrow="Independent frontend foundation"
          title={<>A new AI-first SaaS surface, independent from the legacy frontend.</>}
          description="Phase 1 establishes the design system, shell primitives, semantic tokens, reusable data cards, local AI runtime visibility and operating-system layout patterns without touching backend contracts."
          actions={<StatusBadge tone="ai"><Sparkles className="mr-1 size-3" />Phase 1</StatusBadge>}
        />
        <OperatingSignalGrid workspaceHealth="92%" activeRisks={4} blockedTasks={2} upcomingDeadlines={9} teamLoad="Balanced" aiActions={7} />
        <ResponsiveGrid variant="split">
          <Stack gap="lg">
            <CommandLauncher />
            <RuntimeCapabilityCard
              runtime={{
                provider: "ollama",
                mode: "local",
                label: "Local Ollama",
                isHealthy: true,
                latencyMs: 180,
                chatModel: "llama3.1",
                embeddingModel: "nomic-embed-text",
                localOnly: true,
              }}
            />
          </Stack>
          <OnboardingProgressCard />
        </ResponsiveGrid>
      </Stack>
    </PageFrame>
  );
}
