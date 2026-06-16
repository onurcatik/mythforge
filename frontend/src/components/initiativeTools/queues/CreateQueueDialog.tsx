import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { QueueRead } from "@/api/generated/initiativeAPI.schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInitiatives } from "@/hooks/useInitiatives";
import { useCreateQueue } from "@/hooks/useQueues";
import type { DialogProps } from "@/types/dialog";

type CreateQueueDialogProps = DialogProps & {
  /** If provided, the Initiative is locked and cannot be changed */
  initiativeId?: number;
  /** If provided, pre-selects this Initiative (but user can change it) */
  defaultinitiativeId?: number;
  /** Called after successful creation */
  onSuccess?: (queue: QueueRead) => void;
};

export const CreateQueueDialog = ({
  open,
  onOpenChange,
  initiativeId,
  defaultinitiativeId,
  onSuccess,
}: CreateQueueDialogProps) => {
  const { t } = useTranslation(["queues", "common"]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInitiativeId, setSelectedInitiativeId] = useState(
    defaultinitiativeId ? String(defaultinitiativeId) : "",
  );

  const initiativesQuery = useInitiatives();
  const initiatives = initiativesQuery.data ?? [];

  const effectiveinitiativeId =
    initiativeId ?? (selectedInitiativeId ? Number(selectedInitiativeId) : null);

  const lockedinitiative = initiativeId
    ? (initiatives.find((i) => i.id === initiativeId) ?? null)
    : null;

  // Reset form when dialog closes, set default Initiative when dialog opens
  useEffect(() => {
    if (open) {
      if (defaultinitiativeId) {
        setSelectedInitiativeId(String(defaultinitiativeId));
      }
    } else {
      setName("");
      setDescription("");
      setSelectedInitiativeId(defaultinitiativeId ? String(defaultinitiativeId) : "");
    }
  }, [open, defaultinitiativeId]);

  const createQueue = useCreateQueue({
    onSuccess: (queue) => {
      onOpenChange(false);
      onSuccess?.(queue);
    },
  });

  const isCreating = createQueue.isPending;
  const canSubmit = name.trim() && effectiveinitiativeId && !isCreating;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || !effectiveinitiativeId) return;
    createQueue.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      initiative_id: effectiveinitiativeId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle>{t("createQueue")}</DialogTitle>
          <DialogDescription>{t("noQueuesDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-queue-name">{t("name")}</Label>
            <Input
              id="create-queue-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-queue-description">{t("description")}</Label>
            <Textarea
              id="create-queue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-queue-Initiative">{t("Initiative")}</Label>
            {initiativeId ? (
              <div className="rounded-md border px-3 py-2 text-sm">
                {lockedinitiative?.name ?? t("selectinitiative")}
              </div>
            ) : (
              <Select
                value={selectedInitiativeId}
                onValueChange={setSelectedInitiativeId}
              >
                <SelectTrigger id="create-queue-Initiative">
                  <SelectValue placeholder={t("selectinitiative")} />
                </SelectTrigger>
                <SelectContent>
                  {initiatives.map((Initiative) => (
                    <SelectItem key={Initiative.id} value={String(Initiative.id)}>
                      {Initiative.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("createQueue")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
