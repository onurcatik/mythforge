import { FileText, HelpCircle, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RagAnswerResponse, RagCitation, RagIndexStatusResponse } from "@/hooks/useRag";
import { SourceCard } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { clampPercent, compactNumber } from "./aiOpsUtils";

const sourceIcon = (sourceType: RagCitation["source_type"]): LucideIcon => {
  if (sourceType === "document") return FileText;
  if (sourceType === "comment") return MessageSquareText;
  return Search;
};

export function RagStatusStrip({ status }: { status?: RagIndexStatusResponse | null }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <Surface tone="glass" padding="sm" className="rounded-2xl">
        <div className="text-muted-foreground text-xs">Indexed chunks</div>
        <div className="mt-1 text-lg font-semibold">{compactNumber(status?.indexed_chunks)}</div>
      </Surface>
      <Surface tone="glass" padding="sm" className="rounded-2xl">
        <div className="text-muted-foreground text-xs">Queued jobs</div>
        <div className="mt-1 text-lg font-semibold">{compactNumber((status?.queued_jobs ?? 0) + (status?.processing_jobs ?? 0))}</div>
      </Surface>
      <Surface tone="glass" padding="sm" className="rounded-2xl">
        <div className="text-muted-foreground text-xs">Failed jobs</div>
        <div className="mt-1 text-lg font-semibold">{compactNumber(status?.failed_jobs)}</div>
      </Surface>
      <Surface tone="glass" padding="sm" className="rounded-2xl">
        <div className="text-muted-foreground text-xs">Last indexed</div>
        <div className="mt-1 truncate text-sm font-medium">{status?.last_indexed_at ? new Date(status.last_indexed_at).toLocaleString() : "Not available"}</div>
      </Surface>
    </div>
  );
}

export function RagAnswerExperience({ answer }: { answer?: RagAnswerResponse | null }) {
  if (!answer) {
    return (
      <Surface tone="glass" padding="lg" className="rounded-3xl border-dashed">
        <Stack gap="sm" className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Search className="size-5" />
          </div>
          <div className="font-semibold tracking-[-0.02em]">Ask workspace memory</div>
          <p className="text-muted-foreground text-sm leading-6">Answers appear with confidence, citations, missing context and follow-up questions.</p>
        </Stack>
      </Surface>
    );
  }

  return (
    <Stack gap="md">
      <Surface tone="glass" padding="md" className="rounded-3xl">
        <Stack gap="md">
          <Cluster justify="between" align="start" gap="md">
            <Stack gap="xs">
              <Cluster gap="xs">
                <Badge variant="secondary">Confidence {clampPercent(answer.confidence)}</Badge>
                <Badge variant="outline">Groundedness {clampPercent(answer.groundedness_score)}</Badge>
                <Badge variant="outline">{Math.round(answer.latency_ms)}ms</Badge>
              </Cluster>
              <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer}</p>
            </Stack>
            <div className="hidden rounded-2xl border bg-background/70 p-3 text-primary md:block">
              <ShieldCheck className="size-5" />
            </div>
          </Cluster>
        </Stack>
      </Surface>

      {answer.missing_context.length > 0 ? (
        <Surface tone="muted" padding="md" className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <Stack gap="sm">
            <Cluster gap="sm"><HelpCircle className="size-4 text-amber-600" /><div className="font-medium text-sm">Missing context</div></Cluster>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              {answer.missing_context.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Stack>
        </Surface>
      ) : null}

      {answer.follow_up_questions.length > 0 ? (
        <Surface tone="glass" padding="md" className="rounded-2xl">
          <Stack gap="sm">
            <div className="font-medium text-sm">Follow-up questions</div>
            <div className="flex flex-wrap gap-2">
              {answer.follow_up_questions.map((question) => <Badge key={question} variant="outline" className="max-w-full truncate">{question}</Badge>)}
            </div>
          </Stack>
        </Surface>
      ) : null}

      <Stack gap="sm">
        <Cluster justify="between">
          <div className="font-medium text-sm">Citations</div>
          <Badge variant="outline">{answer.citations.length} cited chunks</Badge>
        </Cluster>
        {answer.citations.length === 0 ? (
          <Surface tone="glass" padding="md" className="rounded-2xl border-dashed text-muted-foreground text-sm">No accessible sources were returned.</Surface>
        ) : (
          <div className="grid gap-2">
            {answer.citations.map((source) => {
              const Icon = sourceIcon(source.source_type);
              return (
                <SourceCard
                  key={source.citation_key}
                  title={<span className="inline-flex items-center gap-2"><Icon className="size-3.5" />{source.title}</span>}
                  excerpt={source.excerpt}
                  sourceType={`${source.source_type} · ${source.citation_key}`}
                  confidence={source.score}
                  href={source.link}
                />
              );
            })}
          </div>
        )}
      </Stack>
    </Stack>
  );
}
