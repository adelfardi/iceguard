import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Columns3,
  GitBranch,
  History,
  Minus,
  Network,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { SchemaDiff, SchemaHistory, SchemaVersion } from '@/types';

type ColumnStatus = 'initial' | 'added' | 'dropped' | 'modified' | 'unchanged';

interface ColumnRow {
  status: ColumnStatus;
  name: string;
  type: string;
  required?: boolean;
  detail?: string;
}

const STATUS_META: Record<
  ColumnStatus,
  { label: string; icon: typeof Plus; rowClass: string; badgeClass: string; dotClass: string }
> = {
  initial: {
    label: 'Initial',
    icon: Sparkles,
    rowClass: 'border-fuchsia-500/20 bg-fuchsia-500/5',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-0',
    dotClass: 'bg-fuchsia-500',
  },
  added: {
    label: 'Added',
    icon: Plus,
    rowClass: 'border-emerald-500/30 bg-emerald-500/5',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0',
    dotClass: 'bg-emerald-500',
  },
  dropped: {
    label: 'Dropped',
    icon: Minus,
    rowClass: 'border-rose-500/30 bg-rose-500/5 opacity-80',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0',
    dotClass: 'bg-rose-500',
  },
  modified: {
    label: 'Modified',
    icon: Pencil,
    rowClass: 'border-amber-500/30 bg-amber-500/5',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0',
    dotClass: 'bg-amber-500',
  },
  unchanged: {
    label: 'Unchanged',
    icon: Columns3,
    rowClass: 'border-border/40 bg-muted/20',
    badgeClass: 'bg-muted text-muted-foreground border-0',
    dotClass: 'bg-muted-foreground/40',
  },
};

function buildColumnRows(version: SchemaVersion): ColumnRow[] {
  if (!version.diff) {
    return version.columns.map((c) => ({
      status: 'initial' as const,
      name: c.name,
      type: c.type,
      required: c.required,
    }));
  }

  const rows: ColumnRow[] = [];
  const touched = new Set<number>();

  for (const c of version.diff.added) {
    touched.add(c.id);
    rows.push({ status: 'added', name: c.name, type: c.type, required: c.required });
  }
  for (const c of version.diff.modified) {
    touched.add(c.id);
    const col = version.columns.find((x) => x.id === c.id);
    rows.push({
      status: 'modified',
      name: c.name,
      type: col?.type ?? '?',
      required: col?.required,
      detail: c.detail,
    });
  }
  for (const c of version.columns) {
    if (!touched.has(c.id)) {
      rows.push({ status: 'unchanged', name: c.name, type: c.type, required: c.required });
    }
  }
  for (const c of version.diff.dropped) {
    rows.push({ status: 'dropped', name: c.name, type: c.type, required: c.required });
  }

  return rows;
}

function formatWhen(ts: string | null): string {
  if (!ts) return 'Unknown date';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function diffSummary(diff: SchemaDiff | null): { added: number; dropped: number; modified: number } {
  return {
    added: diff?.added.length ?? 0,
    dropped: diff?.dropped.length ?? 0,
    modified: diff?.modified.length ?? 0,
  };
}

function TransitionConnector({ diff }: { diff: SchemaDiff | null }) {
  const { added, dropped, modified } = diffSummary(diff);
  const hasChanges = added + dropped + modified > 0;

  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1 min-w-[4.5rem] self-center">
      <div className="flex items-center w-full">
        <div className={cn('h-0.5 flex-1', hasChanges ? 'bg-fuchsia-500/40' : 'bg-border')} />
        <ArrowRight className={cn('h-3.5 w-3.5 shrink-0 mx-0.5', hasChanges ? 'text-fuchsia-500' : 'text-muted-foreground/50')} />
        <div className={cn('h-0.5 flex-1', hasChanges ? 'bg-fuchsia-500/40' : 'bg-border')} />
      </div>
      {hasChanges ? (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {added > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <Plus className="h-2.5 w-2.5" />{added}
            </span>
          )}
          {modified > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <Pencil className="h-2.5 w-2.5" />{modified}
            </span>
          )}
          {dropped > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
              <Minus className="h-2.5 w-2.5" />{dropped}
            </span>
          )}
        </div>
      ) : (
        <span className="mt-1 text-[10px] text-muted-foreground">no change</span>
      )}
    </div>
  );
}

const SCHEMA_CARD_W = 'w-52'; // 13rem — fixed width for all version cards
const SCHEMA_CARD_H = 'h-[8.75rem]'; // fixed height for all version cards
const DEFAULT_VISIBLE_VERSIONS = 5;
const LOAD_MORE_VERSIONS = 5;

function SchemaVersionNode({
  version,
  index,
  selected,
  onSelect,
}: {
  version: SchemaVersion;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { added, dropped, modified } = diffSummary(version.diff);
  const hasChanges = added + dropped + modified > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex shrink-0 flex-col rounded-xl border p-3 text-left transition-all',
        SCHEMA_CARD_W,
        SCHEMA_CARD_H,
        selected
          ? 'border-fuchsia-500/60 bg-fuchsia-500/10 shadow-glow ring-1 ring-fuchsia-500/30'
          : 'border-border/60 bg-card hover:border-fuchsia-500/30 hover:bg-accent/40',
      )}
    >
      {version.current && (
        <span className="absolute right-2 top-2 rounded-md bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-400">
          current
        </span>
      )}

      <div className="flex min-h-[2.25rem] items-center gap-1.5 pr-10">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            version.current
              ? 'bg-fuchsia-500 text-white'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Schema v{version.schemaId}</p>
          <p className="text-[11px] text-muted-foreground">{version.columnCount} columns</p>
        </div>
      </div>

      <p
        className="mt-1.5 line-clamp-2 min-h-[2rem] text-[11px] leading-snug text-muted-foreground"
        title={formatWhen(version.timestamp)}
      >
        {formatWhen(version.timestamp)}
      </p>

      <div className="mt-auto flex h-6 min-h-6 items-center gap-1 overflow-hidden">
        {!version.diff ? (
          <Badge variant="secondary" className="max-w-full truncate text-[10px] font-normal">
            <Sparkles className="mr-0.5 h-2.5 w-2.5 shrink-0" />
            <span className="truncate">Initial</span>
          </Badge>
        ) : hasChanges ? (
          <>
            {added > 0 && (
              <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">
                +{added}
              </Badge>
            )}
            {modified > 0 && (
              <Badge className="shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[10px]">
                ~{modified}
              </Badge>
            )}
            {dropped > 0 && (
              <Badge className="shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0 text-[10px]">
                −{dropped}
              </Badge>
            )}
          </>
        ) : (
          <Badge variant="secondary" className="max-w-full truncate text-[10px] font-normal">
            Same layout
          </Badge>
        )}
      </div>

      <span
        className={cn(
          'absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r bg-card transition-colors',
          selected ? 'border-fuchsia-500/60 bg-fuchsia-500/10' : 'border-border/60 opacity-0 group-hover:opacity-100',
        )}
      />
    </button>
  );
}

function SchemaLegend() {
  const items: ColumnStatus[] = ['initial', 'added', 'modified', 'unchanged', 'dropped'];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Legend</span>
      {items.map((status) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        return (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', meta.dotClass)} />
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function ColumnEvolutionTable({ rows }: { rows: ColumnRow[] }) {
  const grouped = useMemo(() => {
    const order: ColumnStatus[] = ['initial', 'added', 'modified', 'unchanged', 'dropped'];
    return order
      .map((status) => ({ status, items: rows.filter((r) => r.status === status) }))
      .filter((g) => g.items.length > 0);
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No columns in this schema version.</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ status, items }) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        return (
          <div key={status}>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', meta.dotClass)} />
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {meta.label} ({items.length})
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((col) => (
                <div
                  key={`${status}-${col.name}`}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 transition-colors',
                    meta.rowClass,
                    col.status === 'dropped' && 'line-through decoration-rose-500/50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm font-medium truncate">{col.name}</p>
                    <Badge className={cn('shrink-0 text-[10px]', meta.badgeClass)}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{col.type}</p>
                  {col.detail && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{col.detail}</p>
                  )}
                  {col.required && (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">required</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SchemaVersionDetail({ version, previous }: { version: SchemaVersion; previous: SchemaVersion | null }) {
  const rows = useMemo(() => buildColumnRows(version), [version]);
  const { added, dropped, modified, unchanged } = useMemo(() => {
    const counts = { added: 0, dropped: 0, modified: 0, unchanged: 0 };
    for (const r of rows) {
      if (r.status === 'initial') continue;
      if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    }
    return counts;
  }, [rows]);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-fuchsia-500" />
            {previous
              ? `Evolution: Schema v${previous.schemaId} → v${version.schemaId}`
              : `Initial schema (v${version.schemaId})`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatWhen(version.timestamp)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {added > 0 && <Badge className={STATUS_META.added.badgeClass}>+{added} added</Badge>}
          {modified > 0 && <Badge className={STATUS_META.modified.badgeClass}>~{modified} modified</Badge>}
          {dropped > 0 && <Badge className={STATUS_META.dropped.badgeClass}>−{dropped} dropped</Badge>}
          {unchanged > 0 && <Badge className={STATUS_META.unchanged.badgeClass}>{unchanged} unchanged</Badge>}
          {!previous && (
            <Badge className={STATUS_META.initial.badgeClass}>{version.columnCount} columns</Badge>
          )}
        </div>
      </div>

      <ColumnEvolutionTable rows={rows} />
    </div>
  );
}

export function SchemaEvolutionView({
  history,
  isLoading,
}: {
  history: SchemaHistory | undefined;
  isLoading: boolean;
}) {
  const versions = history?.versions ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_VERSIONS);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_VERSIONS);
    setSelectedId(null);
  }, [history?.namespace, history?.tableName, versions.length]);

  const visibleVersions = useMemo(() => {
    if (versions.length <= visibleCount) return versions;
    return versions.slice(-visibleCount);
  }, [versions, visibleCount]);

  const hiddenCount = versions.length - visibleVersions.length;
  const loadMoreCount = Math.min(LOAD_MORE_VERSIONS, hiddenCount);

  const effectiveId = selectedId ?? history?.currentSchemaId ?? versions.at(-1)?.schemaId ?? null;
  const selectedIndex = versions.findIndex((v) => v.schemaId === effectiveId);
  const selected = selectedIndex >= 0 ? versions[selectedIndex] : null;
  const previous = selectedIndex > 0 ? versions[selectedIndex - 1] : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!history || versions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        No schema history recorded for this table yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <SchemaLegend />
        <p className="text-xs text-muted-foreground">
          {visibleVersions.length === versions.length
            ? `${versions.length} version${versions.length > 1 ? 's' : ''}`
            : `${visibleVersions.length} of ${versions.length} versions (most recent)`}
        </p>
      </div>

      {/* Horizontal evolution flow */}
      <ScrollArea className="w-full rounded-xl border border-border/50 bg-muted/5">
        <div className="flex min-w-max items-stretch gap-0 px-4 py-6">
          {hiddenCount > 0 && (
            <div className="flex shrink-0 items-center pr-3 mr-1 border-r border-dashed border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto max-w-[8.5rem] flex-col gap-1.5 whitespace-normal py-3 px-3 text-center"
                onClick={() =>
                  setVisibleCount((c) => Math.min(versions.length, c + LOAD_MORE_VERSIONS))
                }
              >
                <History className="h-4 w-4 shrink-0 text-fuchsia-500" />
                <span className="text-xs leading-snug">
                  Show {loadMoreCount} older
                </span>
                <span className="text-[10px] text-muted-foreground">
                  +{hiddenCount - loadMoreCount > 0
                    ? `${hiddenCount - loadMoreCount} more hidden`
                    : 'all history'}
                </span>
              </Button>
            </div>
          )}
          {visibleVersions.map((v, i) => {
            const globalIndex = versions.findIndex((x) => x.schemaId === v.schemaId);
            return (
              <div key={v.schemaId} className="flex items-stretch">
                {i > 0 && <TransitionConnector diff={v.diff} />}
                <SchemaVersionNode
                  version={v}
                  index={globalIndex}
                  selected={v.schemaId === effectiveId}
                  onSelect={() => setSelectedId(v.schemaId)}
                />
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              setVisibleCount((c) => Math.min(versions.length, c + LOAD_MORE_VERSIONS))
            }
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Load {loadMoreCount} more version{loadMoreCount > 1 ? 's' : ''} from the past
            {hiddenCount > loadMoreCount && (
              <span className="ml-1 text-muted-foreground/70">
                ({hiddenCount - loadMoreCount} remaining)
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Detail for selected version */}
      {selected && <SchemaVersionDetail version={selected} previous={previous} />}
    </div>
  );
}

/** Compact badge-style diff (snapshot compare, etc.) */
export function SchemaDiffGraphic({ diff }: { diff: SchemaDiff }) {
  const empty = diff.added.length === 0 && diff.dropped.length === 0 && diff.modified.length === 0;
  if (empty) {
    return (
      <p className="text-sm text-muted-foreground">
        No column changes ({diff.unchanged} unchanged).
      </p>
    );
  }

  const rows: ColumnRow[] = [
    ...diff.added.map((c) => ({ status: 'added' as const, name: c.name, type: c.type, required: c.required })),
    ...diff.modified.map((c) => ({
      status: 'modified' as const,
      name: c.name,
      type: c.kind,
      detail: c.detail,
    })),
    ...diff.dropped.map((c) => ({ status: 'dropped' as const, name: c.name, type: c.type, required: c.required })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {diff.added.length > 0 && <Badge className={STATUS_META.added.badgeClass}>+{diff.added.length} added</Badge>}
        {diff.modified.length > 0 && <Badge className={STATUS_META.modified.badgeClass}>~{diff.modified.length} modified</Badge>}
        {diff.dropped.length > 0 && <Badge className={STATUS_META.dropped.badgeClass}>−{diff.dropped.length} dropped</Badge>}
        {diff.unchanged > 0 && <Badge className={STATUS_META.unchanged.badgeClass}>{diff.unchanged} unchanged</Badge>}
      </div>
      <ColumnEvolutionTable rows={rows} />
    </div>
  );
}

export function SchemaEvolutionCard({
  history,
  isLoading,
}: {
  history: SchemaHistory | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4 text-fuchsia-500" />
          Schema Evolution
          {history && history.versions.length > 0 && (
            <Badge className="bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-0">
              {history.versions.length} version{history.versions.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SchemaEvolutionView history={history} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
