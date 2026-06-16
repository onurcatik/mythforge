import { Bot, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "robot-toast";

import { ApprovalPill } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAIEnabled } from "@/hooks/useAIEnabled";
import { useAskWorkspace, useRagIndexStatus, useReindexWorkspace } from "@/hooks/useRag";
import { RagAnswerExperience, RagStatusStrip } from "@/widgets/ai-operations";

type AskWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AskWorkspaceDialog({ open, onOpenChange }: AskWorkspaceDialogProps) {
  const { t } = useTranslation(["command", "common"]);
  const [query, setQuery] = useState("");
  const askWorkspace = useAskWorkspace();
  const reindex = useReindexWorkspace();
  const indexStatus = useRagIndexStatus(open);
  const runtime = useAIEnabled();

  const canAsk = query.trim().length >= 2 && !askWorkspace.isPending;
  const answer = askWorkspace.data;
  const statusLine = useMemo(() => {
    const data = indexStatus.data;
    if (!data) return t("rag.statusLoading");
    return t("rag.status", {
      chunks: data.indexed_chunks,
      queued: data.queued_jobs + data.processing_jobs,
      failed: data.failed_jobs,
    });
  }, [indexStatus.data, t]);

  const submit = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    askWorkspace.mutate({ query: trimmed, top_k: 8, max_context_chunks: 8, answer_style: "actionable" });
  };

  const queueReindex = () => {
    reindex.mutate(
      { full_rebuild: false, dry_run: false },
      {
        onSuccess: (payload) => {
          toast.success(t("rag.reindexQueued", { count: payload.queued_jobs }));
          void indexStatus.refetch();
        },
        onError: () => toast.error(t("rag.reindexFailed")),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-grid-bg max-h-[92vh] max-w-6xl overflow-hidden border-primary/10 p-0 shadow-2xl">
        <div className="grid max-h-[92vh] min-h-[74vh] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-r bg-background/80 p-5 backdrop-blur-xl md:p-6">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Workspace memory</Badge>
                <ApprovalPill>citation-first</ApprovalPill>
                <Badge variant="outline" className={runtime.data?.local_only ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"}>
                  {runtime.data?.local_only ? "Local Ollama" : runtime.data?.provider ?? "AI runtime"}
                </Badge>
              </div>
              <DialogTitle className="mt-3 flex items-center gap-3 text-3xl tracking-[-0.04em]">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ai-ring"><Bot className="size-5" /></span>
                {t("rag.title")}
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-6">
                {t("rag.description")} {runtime.data?.local_only ? "Local AI Mode is active; retrieved context stays on Ollama." : "Answers use the configured cloud or hybrid runtime."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 rounded-2xl border bg-card/75 p-3 text-sm text-muted-foreground shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><span>{statusLine}</span></div>
            </div>

            <div className="mt-4">
              <RagStatusStrip status={indexStatus.data} />
            </div>

            <div className="mt-4 rounded-3xl border bg-card/85 p-3 shadow-sm">
              <Textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("rag.placeholder")}
                className="min-h-36 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="text-muted-foreground text-xs">Cmd/Ctrl + Enter to ask · sources stay permission-safe</div>
                <div className="flex items-center gap-2">
                  <Button onClick={submit} disabled={!canAsk}>
                    {askWorkspace.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t("rag.ask")}
                  </Button>
                  <Button variant="outline" onClick={queueReindex} disabled={reindex.isPending}>
                    {reindex.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t("rag.reindex")}
                  </Button>
                </div>
              </div>
            </div>

            {askWorkspace.error ? (
              <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                {t("rag.error")}
              </div>
            ) : null}
          </section>

          <section className="min-h-0 bg-card/70 p-5 backdrop-blur-xl md:p-6">
            <ScrollArea className="h-[78vh] pr-3">
              <RagAnswerExperience answer={answer} />
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
