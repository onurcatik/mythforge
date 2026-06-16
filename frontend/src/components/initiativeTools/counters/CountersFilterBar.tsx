import { ChevronDown, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InitiativeRead } from "@/api/generated/initiativeAPI.schemas";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initiative_FILTER_ALL = "all";

type CountersFilterBarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  initiativeFilter: string;
  oninitiativeFilterChange: (value: string) => void;
  lockedinitiativeId: number | null;
  lockedinitiativeName: string | null;
  initiatives: InitiativeRead[];
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
};

export const CountersFilterBar = ({
  searchQuery,
  onSearchQueryChange,
  initiativeFilter,
  oninitiativeFilterChange,
  lockedinitiativeId,
  lockedinitiativeName,
  initiatives,
  filtersOpen,
  onFiltersOpenChange,
}: CountersFilterBarProps) => {
  const { t } = useTranslation(["counters", "common"]);

  return (
    <Collapsible
      open={filtersOpen}
      onOpenChange={onFiltersOpenChange}
      className="space-y-2"
    >
      <div className="flex items-center justify-between sm:hidden">
        <div className="inline-flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Filter className="h-4 w-4" />
          {t("filters.heading")}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-3">
            {filtersOpen ? t("filters.hide") : t("filters.show")}
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <div className="mt-2 flex flex-wrap items-end gap-4 rounded-md border border-muted bg-background/40 p-3 sm:mt-0">
          <div className="w-full space-y-2 lg:flex-1">
            <Label
              htmlFor="counter-group-search"
              className="block font-medium text-muted-foreground text-xs"
            >
              {t("filters.filterByName")}
            </Label>
            <Input
              id="counter-group-search"
              placeholder={t("filters.searchGroups")}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="min-w-60"
            />
          </div>
          {lockedinitiativeId ? (
            <div className="w-full space-y-2 sm:w-60">
              <Label className="block font-medium text-muted-foreground text-xs">
                {t("filters.filterByinitiative")}
              </Label>
              <p className="font-medium text-sm">
                {lockedinitiativeName ?? t("filters.allinitiatives")}
              </p>
            </div>
          ) : (
            initiatives.length > 1 && (
              <div className="w-full space-y-2 sm:w-60">
                <Label
                  htmlFor="counter-group-Initiative-filter"
                  className="block font-medium text-muted-foreground text-xs"
                >
                  {t("filters.filterByinitiative")}
                </Label>
                <Select value={initiativeFilter} onValueChange={oninitiativeFilterChange}>
                  <SelectTrigger id="counter-group-Initiative-filter">
                    <SelectValue placeholder={t("filters.allinitiatives")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={initiative_FILTER_ALL}>
                      {t("filters.allinitiatives")}
                    </SelectItem>
                    {initiatives.map((Initiative) => (
                      <SelectItem key={Initiative.id} value={String(Initiative.id)}>
                        {Initiative.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
