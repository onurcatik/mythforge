import { useRouter, useSearch } from "@tanstack/react-router";
import type { SortingState } from "@tanstack/react-table";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  DocumentSummary,
  ListDocumentsApiV1DocumentsGetParams,
  TagRead,
  TagSummary,
} from "@/api/generated/initiativeAPI.schemas";
import { BulkEditAccessDialog } from "@/components/documents/BulkEditAccessDialog";
import { BulkEditTagsDialog } from "@/components/documents/BulkEditTagsDialog";
import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { CreateDocumentDialog } from "@/components/documents/CreateDocumentDialog";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { DocumentsFilterBar } from "@/components/documents/DocumentsFilterBar";
import { DocumentsListView } from "@/components/documents/DocumentsListView";
import { DocumentsTagsView } from "@/components/documents/DocumentsTagsView";
import { PaginationBar } from "@/components/documents/PaginationBar";
import type { PropertyFilterCondition } from "@/components/properties/PropertyFilter";
import { UNTAGGED_PATH } from "@/components/tags/TagTreeView";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  useCopyDocument,
  useDeleteDocument,
  useDocumentCounts,
  useDocumentsList,
  usePrefetchDocumentsList,
} from "@/hooks/useDocuments";
import { useGuilds } from "@/hooks/useGuilds";
import {
  canCreate as canCreatePermission,
  useMyInitiativePermissions,
} from "@/hooks/useInitiativeRoles";
import { useInitiatives } from "@/hooks/useInitiatives";
import { useTags } from "@/hooks/useTags";
import { useViewPreference } from "@/hooks/useViewPreference";
import { useGuildPath } from "@/lib/guildUrl";
import {
  buildTagTree,
  collectDescendantTagIds,
  findNodeByPath,
} from "@/lib/tagTree";
import { DocumentKnowledgeCockpit } from "@/widgets/work-core";

const initiative_FILTER_ALL = "all";
const DOCUMENT_VIEW_KEY = "documents:view-mode";

/** Map DataTable column IDs to backend sort field names */
const SORT_FIELD_MAP: Record<string, string> = {
  title: "title",
  "last updated": "updated_at",
};
const DOCUMENT_TAG_FILTERS_KEY = "documents:tag-filters";
const getDefaultDocumentFiltersVisibility = () => {
  if (typeof window === "undefined") {
    return true;
  }
  return window.matchMedia("(min-width: 640px)").matches;
};

type DocumentsViewProps = {
  fixedinitiativeId?: number;
  fixedTagIds?: number[];
  canCreate?: boolean;
};

export const DocumentsView = ({
  fixedinitiativeId,
  fixedTagIds,
  canCreate,
}: DocumentsViewProps) => {
  const { t } = useTranslation(["documents", "common"]);
  const router = useRouter();
  const prefetchDocuments = usePrefetchDocumentsList();
  const { user } = useAuth();
  const { activeGuildId } = useGuilds();
  const gp = useGuildPath();
  const searchParams = useSearch({ strict: false }) as {
    initiativeId?: string;
    create?: string;
    page?: number;
  };
  const lockedinitiativeId = typeof fixedinitiativeId === "number" ? fixedinitiativeId : null;
  const [initiativeFilter, setinitiativeFilter] = useState<string>(
    lockedinitiativeId ? String(lockedinitiativeId) : initiative_FILTER_ALL,
  );
  // Parse the filtered Initiative ID for permission checks
  const filteredinitiativeId =
    initiativeFilter !== initiative_FILTER_ALL ? Number(initiativeFilter) : null;
  const { data: filteredinitiativePermissions } = useMyInitiativePermissions(
    !lockedinitiativeId && filteredinitiativeId ? filteredinitiativeId : null,
  );
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const lastConsumedParams = useRef<string>("");
  const prevGuildIdRef = useRef<number | null>(activeGuildId);
  const isClosingCreateDialog = useRef(false);

  // Check for query params to filter by Initiative (consume once)
  useEffect(() => {
    const urlinitiativeId = searchParams.initiativeId;
    const paramKey = urlinitiativeId || "";

    if (
      urlinitiativeId &&
      !lockedinitiativeId &&
      paramKey !== lastConsumedParams.current
    ) {
      lastConsumedParams.current = paramKey;
      setinitiativeFilter(urlinitiativeId);
    }
  }, [searchParams, lockedinitiativeId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(
    getDefaultDocumentFiltersVisibility,
  );

  // View mode and tag filters are server-persisted in the normal case.
  // When fixedTagIds is provided (tag detail page), the view is forced
  // to "list" and tagFilters mirrors the prop — writes are discarded so
  // we don't pollute the persisted "regular" preferences with the
  // ephemeral fixed-page values.
  const [persistedViewMode, setPersistedViewMode] = useViewPreference<string>(
    DOCUMENT_VIEW_KEY,
    "tags",
  );
  const viewMode: "grid" | "list" | "tags" = fixedTagIds
    ? "list"
    : persistedViewMode === "list" ||
        persistedViewMode === "grid" ||
        persistedViewMode === "tags"
      ? persistedViewMode
      : "tags";
  const setViewMode = useCallback(
    (next: "grid" | "list" | "tags") => {
      if (fixedTagIds) return;
      setPersistedViewMode(next);
    },
    [fixedTagIds, setPersistedViewMode],
  );

  const [persistedTagFilters, setPersistedTagFilters] = useViewPreference<
    number[]
  >(DOCUMENT_TAG_FILTERS_KEY, []);
  const tagFilters = fixedTagIds
    ? fixedTagIds
    : Array.isArray(persistedTagFilters)
      ? persistedTagFilters.filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n),
        )
      : [];
  const setTagFilters = useCallback(
    (next: number[] | ((prev: number[]) => number[])) => {
      if (fixedTagIds) return;
      setPersistedTagFilters((prev) => {
        const safe = Array.isArray(prev) ? prev : [];
        return typeof next === "function" ? next(safe) : next;
      });
    },
    [fixedTagIds, setPersistedTagFilters],
  );

  const [treeSelectedPaths, setTreeSelectedPaths] = useState<Set<string>>(
    new Set(),
  );

  const [propertyFilters, setPropertyFilters] = useState<
    PropertyFilterCondition[]
  >([]);

  const [page, setPageState] = useState(() => searchParams.page ?? 1);
  const [pageSize, setPageSizeState] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>("updated_at");
  const [sortDir, setSortDir] = useState<string | undefined>("desc");

  const setPage = useCallback(
    (updater: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        void router.navigate({
          to: ".",
          search: {
            ...searchParamsRef.current,
            page: next <= 1 ? undefined : next,
          },
          replace: true,
        });
        return next;
      });
    },
    [router],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSizeState(size);
      setPage(1);
    },
    [setPage],
  );

  const handleSortingChange = useCallback(
    (sorting: SortingState) => {
      if (sorting.length > 0) {
        const col = sorting[0];
        const field = SORT_FIELD_MAP[col.id];
        if (field) {
          setSortBy(field);
          setSortDir(col.desc ? "desc" : "asc");
        } else {
          setSortBy(undefined);
          setSortDir(undefined);
        }
      } else {
        setSortBy(undefined);
        setSortDir(undefined);
      }
      setPage(1);
    },
    [setPage],
  );

  const { data: allTags = [] } = useTags();

  // Convert tag IDs to Tag objects for TagPicker
  const selectedTagsForFilter = useMemo(() => {
    const tagMap = new Map(allTags.map((tg) => [tg.id, tg]));
    return tagFilters
      .map((id) => tagMap.get(id))
      .filter((tg): tg is TagRead => tg !== undefined);
  }, [allTags, tagFilters]);

  const handleTagFiltersChange = (newTags: TagSummary[]) => {
    setTagFilters(newTags.map((tg) => tg.id));
  };

  const handleTreeTagToggle = (fullPath: string, ctrlKey: boolean) => {
    setTreeSelectedPaths((prev) => {
      const next = new Set(prev);
      if (ctrlKey) {
        // Ctrl/Cmd+Click: toggle in selection
        if (next.has(fullPath)) {
          next.delete(fullPath);
        } else {
          next.add(fullPath);
        }
      } else {
        // Plain click: replace selection, or deselect if already the only selection
        if (next.size === 1 && next.has(fullPath)) {
          next.clear();
        } else {
          next.clear();
          next.add(fullPath);
        }
      }
      return next;
    });
  };

  // Reset tree selection when switching away from tags view
  useEffect(() => {
    if (viewMode !== "tags") {
      setTreeSelectedPaths(new Set());
    }
  }, [viewMode]);

  useEffect(() => {
    if (lockedinitiativeId) {
      const lockedValue = String(lockedinitiativeId);
      setinitiativeFilter((prev) => (prev === lockedValue ? prev : lockedValue));
    }
  }, [lockedinitiativeId]);

  // Reset Initiative filter when guild changes (Initiative IDs are guild-specific)
  useEffect(() => {
    const prevGuildId = prevGuildIdRef.current;
    prevGuildIdRef.current = activeGuildId;
    // Only reset if guild actually changed (not on initial mount)
    if (
      prevGuildId !== null &&
      prevGuildId !== activeGuildId &&
      !lockedinitiativeId
    ) {
      setinitiativeFilter(initiative_FILTER_ALL);
      lastConsumedParams.current = "";
    }
  }, [activeGuildId, lockedinitiativeId]);

  // In tags view, the tree does its own client-side filtering, so skip backend tag filters
  // When fixedTagIds is provided, always use them regardless of view mode
  const effectiveTagFilters = fixedTagIds
    ? fixedTagIds
    : viewMode === "tags"
      ? []
      : tagFilters;

  // For tags view, derive tag_ids from tree selection for server-side filtering
  const treeTagIds = useMemo(() => {
    if (viewMode !== "tags" || treeSelectedPaths.size === 0) return [];
    const tagPaths = new Set(treeSelectedPaths);
    tagPaths.delete(UNTAGGED_PATH);
    const tree = buildTagTree(allTags);
    const ids: number[] = [];
    for (const path of tagPaths) {
      const node = findNodeByPath(tree, path);
      if (node) {
        for (const id of collectDescendantTagIds(node)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }, [viewMode, treeSelectedPaths, allTags]);

  // Whether "untagged" is selected in tags view
  const treeWantsUntagged =
    viewMode === "tags" && treeSelectedPaths.has(UNTAGGED_PATH);

  // Effective tag_ids sent to the server for the document list query
  // In tags view: use tree-derived tag IDs; in other views: use filter bar tag IDs
  const queryTagIds = viewMode === "tags" ? treeTagIds : effectiveTagFilters;

  // Reset to page 1 when filters or view mode change
  const _queryTagIdsKey = JSON.stringify(queryTagIds);
  const propertyFiltersKey = JSON.stringify(propertyFilters);
  useEffect(() => {
    setPage(1);
  }, [setPage]);

  // Serialize property filters for the backend query string. The backend
  // expects a JSON-encoded array on ``property_filters`` and we pre-encode
  // it just before passing to the hook so the react-query key stays a
  // primitive string (same serialization => same cache key).
  const encodedPropertyFilters =
    propertyFilters.length > 0 ? propertyFiltersKey : null;

  const documentsQueryParams: ListDocumentsApiV1DocumentsGetParams = {
    ...(initiativeFilter !== initiative_FILTER_ALL
      ? { initiative_id: Number(initiativeFilter) }
      : {}),
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    ...(queryTagIds.length > 0 ? { tag_ids: queryTagIds } : {}),
    ...(treeWantsUntagged ? { untagged: true } : {}),
    ...(encodedPropertyFilters
      ? { property_filters: encodedPropertyFilters }
      : {}),
    page,
    page_size: pageSize,
    ...(sortBy ? { sort_by: sortBy } : {}),
    ...(sortDir ? { sort_dir: sortDir } : {}),
  };

  const documentsQuery = useDocumentsList(documentsQueryParams);

  // Counts query for tags view sidebar
  const countsQueryParams = {
    ...(initiativeFilter !== initiative_FILTER_ALL
      ? { initiative_id: Number(initiativeFilter) }
      : {}),
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
  };

  const countsQuery = useDocumentCounts(countsQueryParams, {
    enabled: viewMode === "tags",
  });

  // Prefetch adjacent page on hover
  const prefetchPage = useCallback(
    (targetPage: number) => {
      if (targetPage < 1) return;
      const prefetchParams: ListDocumentsApiV1DocumentsGetParams = {
        ...(initiativeFilter !== initiative_FILTER_ALL
          ? { initiative_id: Number(initiativeFilter) }
          : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(queryTagIds.length > 0 ? { tag_ids: queryTagIds } : {}),
        ...(treeWantsUntagged ? { untagged: true } : {}),
        ...(encodedPropertyFilters
          ? { property_filters: encodedPropertyFilters }
          : {}),
        page: targetPage,
        page_size: pageSize,
        ...(sortBy ? { sort_by: sortBy } : {}),
        ...(sortDir ? { sort_dir: sortDir } : {}),
      };
      void prefetchDocuments(prefetchParams);
    },
    [
      initiativeFilter,
      searchQuery,
      queryTagIds,
      treeWantsUntagged,
      encodedPropertyFilters,
      pageSize,
      sortBy,
      sortDir,
      prefetchDocuments,
    ],
  );

  const initiativesQuery = useInitiatives();

  // Filter initiatives where user can create documents
  const creatableInitiatives = useMemo(() => {
    const initiatives = initiativesQuery.data ?? [];
    if (!user) {
      return [];
    }
    return initiatives.filter((Initiative) =>
      Initiative.members.some(
        (member) => member.user.id === user.id && member.can_create_docs,
      ),
    );
  }, [initiativesQuery.data, user]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialoginitiativeId, setCreateDialoginitiativeId] = useState<
    number | undefined
  >(lockedinitiativeId ?? undefined);
  const [selectedDocuments, setSelectedDocuments] = useState<DocumentSummary[]>(
    [],
  );

  // Check if user owns all selected documents (required for delete)
  const canDeleteSelectedDocuments = useMemo(() => {
    if (!user || selectedDocuments.length === 0) {
      return false;
    }
    return selectedDocuments.every((doc) => {
      const permission = (doc.permissions ?? []).find(
        (p) => p.user_id === user.id,
      );
      return permission?.level === "owner";
    });
  }, [selectedDocuments, user]);

  // Check if user has write access on all selected documents (required for duplicate and bulk edit)
  const canDuplicateSelectedDocuments = useMemo(() => {
    if (!user || selectedDocuments.length === 0) {
      return false;
    }
    return selectedDocuments.every((doc) => {
      const permission = (doc.permissions ?? []).find(
        (p) => p.user_id === user.id,
      );
      return permission?.level === "owner" || permission?.level === "write";
    });
  }, [selectedDocuments, user]);

  const canEditSelectedDocuments = canDuplicateSelectedDocuments;

  const [bulkEditTagsOpen, setBulkEditTagsOpen] = useState(false);
  const [bulkEditAccessOpen, setBulkEditAccessOpen] = useState(false);

  // Check if user can view docs for the filtered Initiative
  const canViewDocs = useMemo(() => {
    // If no specific Initiative is filtered, user can view the page
    const effectiveinitiativeId = lockedinitiativeId ?? filteredinitiativeId;
    if (!effectiveinitiativeId || !user) {
      return true;
    }
    const Initiative = initiativesQuery.data?.find((i) => i.id === effectiveinitiativeId);
    if (!Initiative) {
      return true; // Initiative not loaded yet, assume access
    }
    const membership = Initiative.members.find((m) => m.user.id === user.id);
    if (!membership) {
      return true; // Not a member, let the backend handle access control
    }
    return membership.can_view_docs !== false;
  }, [lockedinitiativeId, filteredinitiativeId, user, initiativesQuery.data]);

  // Use explicit canCreate prop if provided (from role permissions), otherwise check filtered Initiative permissions
  const canCreateDocuments = useMemo(() => {
    // If explicit prop provided (e.g., from initiativeDetailPage), use it
    if (canCreate !== undefined) {
      return canCreate;
    }
    // If a specific Initiative is filtered, check permissions for that Initiative
    if (filteredinitiativeId && filteredinitiativePermissions) {
      return canCreatePermission(filteredinitiativePermissions, "docs");
    }
    // Fall back to legacy check (user is PM in any Initiative)
    if (lockedinitiativeId) {
      return creatableInitiatives.some((Initiative) => Initiative.id === lockedinitiativeId);
    }
    return creatableInitiatives.length > 0;
  }, [
    canCreate,
    filteredinitiativeId,
    filteredinitiativePermissions,
    lockedinitiativeId,
    creatableInitiatives,
  ]);

  // Open create dialog when ?create=true is in URL
  useEffect(() => {
    const shouldCreate = searchParams.create === "true";
    const urlinitiativeId = searchParams.initiativeId;

    if (shouldCreate && !createDialogOpen && !isClosingCreateDialog.current) {
      setCreateDialogOpen(true);
      if (urlinitiativeId && !lockedinitiativeId) {
        setCreateDialoginitiativeId(Number(urlinitiativeId));
      }
    }
    // Reset the closing flag once URL no longer has create=true
    if (!shouldCreate) {
      isClosingCreateDialog.current = false;
    }
  }, [searchParams, lockedinitiativeId, createDialogOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setFiltersOpen(event.matches);
    };
    setFiltersOpen(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const handleDocumentCreated = (document: { id: number }) => {
    router.navigate({
      to: gp(`/documents/${document.id}`),
    });
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    // Clear ?create from URL when dialog closes
    if (!open && searchParams.create) {
      isClosingCreateDialog.current = true;
      router.navigate({
        to: gp("/documents"),
        search: { initiativeId: searchParams.initiativeId },
        replace: true,
      });
    }
  };

  const deleteDocuments = useDeleteDocument({
    onSuccess: () => setSelectedDocuments([]),
  });

  const duplicateDocuments = useCopyDocument({
    onSuccess: () => setSelectedDocuments([]),
  });

  const initiatives = initiativesQuery.data ?? [];
  // Filter initiatives where user can view docs (for the dropdown)
  const viewableInitiatives = useMemo(() => {
    const allinitiatives = initiativesQuery.data ?? [];
    if (!user) return allinitiatives;
    return allinitiatives.filter((Initiative) => {
      const membership = Initiative.members.find((m) => m.user.id === user.id);
      // If not a member, include it (backend will handle access control)
      if (!membership) return true;
      return membership.can_view_docs !== false;
    });
  }, [initiativesQuery.data, user]);
  const lockedinitiative = lockedinitiativeId
    ? (initiatives.find((Initiative) => Initiative.id === lockedinitiativeId) ?? null)
    : null;

  // Get IDs of initiatives where user can view docs
  const viewableinitiativeIds = useMemo(() => {
    return new Set(viewableInitiatives.map((i) => i.id));
  }, [viewableInitiatives]);

  // Filter documents to only show those from viewable initiatives
  const documents = useMemo(() => {
    const allDocs = documentsQuery.data?.items ?? [];
    if (!user) return allDocs;
    return allDocs.filter((doc) => viewableinitiativeIds.has(doc.initiative_id));
  }, [documentsQuery.data, user, viewableinitiativeIds]);

  const totalCount = documentsQuery.data?.total_count ?? 0;
  const hasNext = documentsQuery.data?.has_next ?? false;
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;

  // Server handles untagged filtering via ?untagged=true param
  const displayDocuments = documents;

  return (
    <div className="space-y-6">
      {!fixedTagIds ? (
        <DocumentKnowledgeCockpit
          totalCount={totalCount}
          visibleCount={displayDocuments.length}
          selectedCount={selectedDocuments.length}
          viewMode={viewMode}
          canCreate={canCreateDocuments}
          onCreate={() => setCreateDialogOpen(true)}
          onAskWorkspace={() =>
            getOpenAICommandCenter()?.(
              "Bu workspace dokümanlarında kaynaklı cevap üret: en önemli kararları, riskleri ve aksiyon maddelerini özetle.",
            )
          }
          onExtractPlan={() =>
            getOpenAICommandCenter()?.(
              "Dokümanlardan toplantı notlarını, kararları ve aksiyon maddelerini çıkarıp onaylı görev planına dönüştür.",
            )
          }
          onViewModeChange={setViewMode}
        />
      ) : null}

      <DocumentsFilterBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        initiativeFilter={initiativeFilter}
        oninitiativeFilterChange={setinitiativeFilter}
        lockedinitiativeId={lockedinitiativeId}
        lockedinitiativeName={lockedinitiative?.name ?? null}
        viewableInitiatives={viewableInitiatives}
        initiativesLoading={initiativesQuery.isLoading}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        viewMode={viewMode}
        tagFilters={selectedTagsForFilter}
        onTagFiltersChange={handleTagFiltersChange}
        fixedTagIds={fixedTagIds}
        propertyFilters={propertyFilters}
        onPropertyFiltersChange={setPropertyFilters}
      />

      {!canViewDocs ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("page.accessRestrictedTitle")}
            </CardTitle>
            <CardDescription>
              {t("page.accessRestrictedDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : documentsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("page.loading")}
        </div>
      ) : documentsQuery.isError ? (
        <p className="text-destructive text-sm">{t("page.loadError")}</p>
      ) : viewMode === "tags" ? (
        <DocumentsTagsView
          documents={displayDocuments}
          allTags={allTags}
          tagCounts={countsQuery.data?.tag_counts ?? {}}
          untaggedCount={countsQuery.data?.untagged_count ?? 0}
          treeSelectedPaths={treeSelectedPaths}
          onToggleTag={handleTreeTagToggle}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          hasNext={hasNext}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onPrefetchPage={prefetchPage}
        />
      ) : totalCount > 0 ? (
        viewMode === "grid" ? (
          <>
            <div className="animate grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {documents.map((document) => (
                <DocumentCard key={document.id} document={document} hideinitiative />
              ))}
            </div>
            {totalCount > 0 && (
              <PaginationBar
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                hasNext={hasNext}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                onPrefetchPage={prefetchPage}
              />
            )}
          </>
        ) : (
          <DocumentsListView
            documents={documents}
            selectedDocuments={selectedDocuments}
            onSelectedDocumentsChange={setSelectedDocuments}
            canEditSelectedDocuments={canEditSelectedDocuments}
            canDuplicateSelectedDocuments={canDuplicateSelectedDocuments}
            canDeleteSelectedDocuments={canDeleteSelectedDocuments}
            onBulkEditTags={() => setBulkEditTagsOpen(true)}
            onBulkEditAccess={() => setBulkEditAccessOpen(true)}
            onBulkDuplicate={() => duplicateDocuments.mutate(selectedDocuments)}
            isBulkDuplicating={duplicateDocuments.isPending}
            onBulkDelete={() => {
              if (
                confirm(
                  t("bulk.deleteConfirm", { count: selectedDocuments.length }),
                )
              ) {
                deleteDocuments.mutate(selectedDocuments.map((doc) => doc.id));
              }
            }}
            isBulkDeleting={deleteDocuments.isPending}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            page={page}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={setPage}
            onPrefetchPage={prefetchPage}
            onSortingChange={handleSortingChange}
          />
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("page.noDocumentsTitle")}</CardTitle>
            <CardDescription>
              {t("page.noDocumentsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canCreateDocuments}
            >
              {t("page.startWriting")}
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateDocumentDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        initiativeId={lockedinitiativeId ?? undefined}
        defaultinitiativeId={
          initiativeFilter !== initiative_FILTER_ALL
            ? Number(initiativeFilter)
            : createDialoginitiativeId
        }
        initiatives={creatableInitiatives}
        onSuccess={handleDocumentCreated}
      />

      <BulkEditTagsDialog
        open={bulkEditTagsOpen}
        onOpenChange={setBulkEditTagsOpen}
        documents={selectedDocuments}
        onSuccess={() => {}}
      />

      <BulkEditAccessDialog
        open={bulkEditAccessOpen}
        onOpenChange={setBulkEditAccessOpen}
        documents={selectedDocuments}
        onSuccess={() => {}}
      />

      {canCreateDocuments ? (
        <Button
          type="button"
          className="fixed right-6 bottom-6 z-40 h-12 rounded-full px-6 shadow-lg shadow-primary/40"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("page.newDocument")}
        </Button>
      ) : null}
    </div>
  );
};

export const DocumentsPage = () => <DocumentsView />;
