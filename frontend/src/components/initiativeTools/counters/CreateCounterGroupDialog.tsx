import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CounterGroupRead } from "@/api/generated/initiativeAPI.schemas";
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
import { useCreateCounterGroup } from "@/hooks/useCounters";
import { useInitiatives } from "@/hooks/useInitiatives";
import type { DialogProps } from "@/types/dialog";

type CreateCounterGroupDialogProps = DialogProps & {
  initiativeId?: number;
  defaultinitiativeId?: number;
  onSuccess?: (group: CounterGroupRead) => void;
};

export const CreateCounterGroupDialog = ({
  open,
  onOpenChange,
  initiativeId,
  defaultinitiativeId,
  onSuccess,
}: CreateCounterGroupDialogProps) => {
  const { t } = useTranslation(["counters", "common"]);

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

  const createGroup = useCreateCounterGroup({
    onSuccess: (group) => {
      onOpenChange(false);
      onSuccess?.(group);
    },
  });

  const isCreating = createGroup.isPending;
  const canSubmit = !!name.trim() && !!effectiveinitiativeId && !isCreating;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || !effectiveinitiativeId) return;
    createGroup.mutate({
      name: trimmedName,
      description: description.trim() || undefined,
      initiative_id: effectiveinitiativeId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle>{t("createGroup")}</DialogTitle>
          <DialogDescription>{t("noGroupsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-counter-group-name">{t("name")}</Label>
            <Input
              id="create-counter-group-name"
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
            <Label htmlFor="create-counter-group-description">
              {t("description")}
            </Label>
            <Textarea
              id="create-counter-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-counter-group-Initiative">{t("Initiative")}</Label>
            {initiativeId ? (
              <div className="rounded-md border px-3 py-2 text-sm">
                {lockedinitiative?.name ?? t("selectinitiative")}
              </div>
            ) : (
              <Select
                value={selectedInitiativeId}
                onValueChange={setSelectedInitiativeId}
              >
                <SelectTrigger id="create-counter-group-Initiative">
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
              t("createGroup")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
