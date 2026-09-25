import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  CircleDot,
  Database,
  Eraser,
  FileStack,
  GitBranch,
  GitCommitHorizontal,
  Paintbrush,
  Plus,
  RefreshCw,
  Repeat,
  Scissors,
  Tag,
  Trash2,
  Unlink,
  Zap,
} from 'lucide-react';
import { tableApi, apiErrorMessage } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SnapshotInfo, TableRef, TableVersioning } from '@/types';
import { SnapshotsList } from './SnapshotsList';

/* ── Graph layout ─────────────────────────────────────────────────────────── */

const ROW_H = 44;
const LANE_W = 22;
const GRAPH_PAD = 14;
const NODE_R = 6;

// main is always lane 0 / emerald; other lines cycle through this palette.
const LANE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16'];
const DETACHED_COLOR = '#64748b';

type LaneKind = 'branch' | 'tag' | 'detached';

interface Lane {
  index: number;
  color: string;
  kind: LaneKind;
  label: string;
}

interface GraphNode {
  snap: SnapshotInfo;
  row: number;
  lane: Lane;
  branches: TableRef[];
  tags: TableRef[];
}

interface GraphEdge {
  from: GraphNode;
  to: GraphNode | null; // null = parent no longer in metadata (expired)
  color: string;
  dashed: boolean;
}

interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lanes: Lane[];
}

const byNewest = (a: SnapshotInfo, b: SnapshotInfo) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || b.snapshotId.localeCompare(a.snapshotId);

/**
 * Git-style lane assignment: walk each ref's ancestry from its head and claim every snapshot not
 * already owned by an earlier line (main first, then branches newest-first, then tags). The first
 * already-owned ancestor is the fork point. What no ref reaches (rolled back / unreferenced) is
 * grouped into grey "detached" lines.
 */
function layoutGraph(data: TableVersioning, showDetached: boolean): GraphLayout {
  const byId = new Map(data.snapshots.map((s) => [s.snapshotId, s]));
  const owner = new Map<string, Lane>();
  const lanes: Lane[] = [];

  const claim = (headId: string, kind: LaneKind, label: string) => {
    if (!byId.has(headId) || owner.has(headId)) return;
    const lane: Lane = {
      index: lanes.length,
      color: kind === 'detached' ? DETACHED_COLOR : LANE_COLORS[lanes.length % LANE_COLORS.length],
      kind,
      label,
    };
    lanes.push(lane);
    let id: string | null = headId;
    while (id && byId.has(id) && !owner.has(id)) {
      owner.set(id, lane);
      id = byId.get(id)!.parentSnapshotId;
    }
  };

  const headTime = (r: TableRef) => new Date(byId.get(r.snapshotId)?.timestamp ?? 0).getTime();
  const branches = data.refs.filter((r) => r.type === 'BRANCH');
  const main = branches.find((r) => r.name === 'main');
  if (main) claim(main.snapshotId, 'branch', 'main');
  // Tables without a main ref (Nessie reconstruction, empty metadata): anchor on the current snapshot.
  else if (data.currentSnapshotId) claim(data.currentSnapshotId, 'branch', 'current');
  branches
    .filter((r) => r !== main)
    .sort((a, b) => headTime(b) - headTime(a))
    .forEach((r) => claim(r.snapshotId, 'branch', r.name));
  data.refs
    .filter((r) => r.type === 'TAG')
    .sort((a, b) => headTime(b) - headTime(a))
    .forEach((r) => claim(r.snapshotId, 'tag', r.name));

  if (showDetached) {
    [...data.snapshots].sort(byNewest).forEach((s) => claim(s.snapshotId, 'detached', 'unreferenced'));
  }

  const visible = data.snapshots.filter((s) => owner.has(s.snapshotId)).sort(byNewest);
  const nodes: GraphNode[] = visible.map((snap, row) => ({
    snap,
    row,
    lane: owner.get(snap.snapshotId)!,
    branches: data.refs.filter((r) => r.type === 'BRANCH' && r.snapshotId === snap.snapshotId),
    tags: data.refs.filter((r) => r.type === 'TAG' && r.snapshotId === snap.snapshotId),
  }));
  const nodeById = new Map(nodes.map((n) => [n.snap.snapshotId, n]));

  const edges: GraphEdge[] = [];
  for (const n of nodes) {
    const parentId = n.snap.parentSnapshotId;
    if (!parentId) continue;
    const parent = nodeById.get(parentId) ?? null;
    edges.push({ from: n, to: parent, color: n.lane.color, dashed: n.lane.kind !== 'branch' || !parent });
  }

  // Compact the lane indexes so hidden (detached) lanes leave no gaps.
  const used = lanes.filter((l) => nodes.some((n) => n.lane === l));
  used.forEach((l, i) => (l.index = i));
  return { nodes, edges, lanes: used };
}

const laneX = (lane: Lane) => GRAPH_PAD + lane.index * LANE_W;
const rowY = (row: number) => row * ROW_H + ROW_H / 2;

function edgePath(e: GraphEdge): string {
  const x1 = laneX(e.from.lane);
  const y1 = rowY(e.from.row);
  if (!e.to) return `M ${x1} ${y1} L ${x1} ${y1 + ROW_H * 0.7}`;
  const x2 = laneX(e.to.lane);
  const y2 = rowY(e.to.row);
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  // Stay in the child's lane, then bend into the parent's lane just above it.
  const bendStart = y2 - ROW_H;
  const mid = y2 - ROW_H / 2;
  return `M ${x1} ${y1} L ${x1} ${bendStart} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

/* ── Presentation helpers ─────────────────────────────────────────────────── */

const OP_META: Record<string, { Icon: typeof Plus; className: string }> = {
  append: { Icon: Plus, className: 'text-emerald-500' },
  overwrite: { Icon: RefreshCw, className: 'text-blue-500' },
  replace: { Icon: Repeat, className: 'text-cyan-500' },
  delete: { Icon: Trash2, className: 'text-red-500' },
  EXPIRE_SNAPSHOTS: { Icon: Camera, className: 'text-violet-500' },
  REWRITE_MANIFESTS: { Icon: FileStack, className: 'text-amber-500' },
  REWRITE_DATA_FILES: { Icon: Database, className: 'text-emerald-500' },
  REWRITE_POSITION_DELETE_FILES: { Icon: Eraser, className: 'text-cyan-500' },
  REWRITE_EQUALITY_DELETE_FILES: { Icon: Scissors, className: 'text-teal-500' },
  REMOVE_ORPHAN_FILES: { Icon: Paintbrush, className: 'text-rose-500' },
};

function OpLabel({ operation }: { operation: string }) {
  const meta = OP_META[operation] ?? { Icon: Zap, className: 'text-slate-400' };
  const { Icon } = meta;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className={cn('h-3.5 w-3.5', meta.className)} />
      {operation}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDuration(ms: number | null): string {
  if (ms == null) return 'table default';
  const d = ms / 86_400_000;
  if (d >= 1) return `${+d.toFixed(1)} d`;
  const h = ms / 3_600_000;
  if (h >= 1) return `${+h.toFixed(1)} h`;
  return `${Math.round(ms / 60_000)} min`;
}

const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-5)}` : id);

function RefPill({ refInfo, color }: { refInfo: TableRef; color: string }) {
  const Icon = refInfo.type === 'TAG' ? Tag : GitBranch;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
      style={
        refInfo.type === 'TAG'
          ? { borderColor: '#f59e0b66', background: '#f59e0b1a', color: '#d97706' }
          : { borderColor: `${color}66`, background: `${color}1a`, color }
      }
    >
      <Icon className="h-3 w-3" />
      {refInfo.name}
    </span>
  );
}

/* ── Tab ──────────────────────────────────────────────────────────────────── */

export function VersioningTab({ catalogId, namespace, table }: { catalogId: number; namespace: string; table: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['table-versioning', catalogId, namespace, table],
    queryFn: () => tableApi.getVersioning(catalogId, namespace, table),
  });
  const [showDetached, setShowDetached] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 'graph' is the main view; the counters open a list on demand.
  const [view, setView] = useState<ListView | 'graph'>('graph');
  const toggleView = (v: ListView) => setView((cur) => (cur === v ? 'graph' : v));
  const showInGraph = (snapshotId: string) => {
    setSelectedId(snapshotId);
    setView('graph');
  };

  const layout = useMemo(() => (data ? layoutGraph(data, showDetached) : null), [data, showDetached]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data || !layout) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          Could not load versioning state: {apiErrorMessage(error)}
        </CardContent>
      </Card>
    );
  }

  const branches = data.refs.filter((r) => r.type === 'BRANCH');
  const tags = data.refs.filter((r) => r.type === 'TAG');
  const detachedCount = data.snapshots.length - layoutGraph(data, false).nodes.length;
  const laneColorOf = (ref: TableRef) =>
    layout.nodes.find((n) => n.snap.snapshotId === ref.snapshotId && n.lane.label === ref.name)?.lane.color ??
    layout.nodes.find((n) => n.snap.snapshotId === ref.snapshotId)?.lane.color ??
    DETACHED_COLOR;
  const selected = layout.nodes.find((n) => n.snap.snapshotId === selectedId) ?? layout.nodes[0];
  const graphWidth = GRAPH_PAD * 2 + Math.max(0, layout.lanes.length - 1) * LANE_W;
  const byId = new Map(data.snapshots.map((s) => [s.snapshotId, s]));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={<GitBranch className="h-4 w-4 text-emerald-500" />} label="Branches" value={branches.length}
          active={view === 'branches'} onClick={() => toggleView('branches')} />
        <SummaryTile icon={<Tag className="h-4 w-4 text-amber-500" />} label="Tags" value={tags.length}
          active={view === 'tags'} onClick={() => toggleView('tags')} />
        <SummaryTile icon={<GitCommitHorizontal className="h-4 w-4 text-violet-500" />} label="Snapshots" value={data.snapshots.length}
          active={view === 'snapshots'} onClick={() => toggleView('snapshots')} />
        <SummaryTile icon={<Unlink className="h-4 w-4 text-slate-500" />} label="Unreferenced" value={detachedCount} />
      </div>

      {view !== 'graph' ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              {view === 'branches' && <><GitBranch className="h-5 w-5 text-emerald-500" /> Branches <Badge variant="secondary">{branches.length}</Badge></>}
              {view === 'tags' && <><Tag className="h-5 w-5 text-amber-500" /> Tags <Badge variant="secondary">{tags.length}</Badge></>}
              {view === 'snapshots' && <><Camera className="h-5 w-5 text-violet-500" /> Snapshots <Badge variant="secondary">{data.snapshots.length}</Badge></>}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setView('graph')}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to version graph
            </Button>
          </CardHeader>
          <CardContent>
            {view === 'snapshots' ? (
              <SnapshotsList catalogId={catalogId} namespace={namespace} table={table} snapshots={data.snapshots} />
            ) : (
              <RefsTable
                refs={view === 'branches' ? branches : tags}
                kind={view}
                byId={byId}
                colorOf={laneColorOf}
                onShow={showInGraph}
              />
            )}
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Graph */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-500" /> Version graph
            </CardTitle>
            {detachedCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch id="show-detached" checked={showDetached} onCheckedChange={setShowDetached} />
                <Label htmlFor="show-detached" className="text-xs text-muted-foreground">Show unreferenced snapshots</Label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {data.nessieRef && (
              <p className="mb-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Nessie versions the whole catalog: this history is rebuilt from the commit log of
                reference <span className="font-mono text-foreground">{data.nessieRef}</span>. Catalog branches and tags are listed alongside.
              </p>
            )}
            {layout.nodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No snapshots yet — the table has no version history.</p>
            ) : (
              <div className="max-h-[640px] overflow-auto rounded-md border">
                <div className="relative min-w-[520px]" style={{ height: layout.nodes.length * ROW_H }}>
                  <svg
                    className="pointer-events-none absolute left-0 top-0 z-10"
                    width={graphWidth}
                    height={layout.nodes.length * ROW_H}
                    aria-hidden="true"
                  >
                    {layout.edges.map((e) => (
                      <path
                        key={`${e.from.snap.snapshotId}-e`}
                        d={edgePath(e)}
                        fill="none"
                        stroke={e.color}
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeDasharray={e.dashed ? '4 4' : undefined}
                        opacity={e.from.lane.kind === 'detached' ? 0.55 : 0.9}
                      />
                    ))}
                    {layout.nodes.map((n) => {
                      const isCurrent = n.snap.snapshotId === data.currentSnapshotId;
                      const isSelected = n === selected;
                      const cx = laneX(n.lane);
                      const cy = rowY(n.row);
                      return (
                        <g key={n.snap.snapshotId}>
                          {(isCurrent || isSelected) && (
                            <circle cx={cx} cy={cy} r={NODE_R + 4} fill={n.lane.color} opacity={isSelected ? 0.3 : 0.18} />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={NODE_R}
                            fill={n.tags.length || n.branches.length ? n.lane.color : 'var(--card)'}
                            stroke={n.lane.color}
                            strokeWidth={2.5}
                            opacity={n.lane.kind === 'detached' ? 0.7 : 1}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {layout.nodes.map((n) => {
                    const isCurrent = n.snap.snapshotId === data.currentSnapshotId;
                    const added = n.snap.summary['added-records'];
                    return (
                      <button
                        key={n.snap.snapshotId}
                        type="button"
                        onClick={() => setSelectedId(n.snap.snapshotId)}
                        className={cn(
                          'absolute left-0 right-0 flex items-center gap-3 border-b border-border/40 pr-3 text-left transition-colors hover:bg-muted/50',
                          n === selected && 'bg-muted/70',
                          n.lane.kind === 'detached' && 'opacity-70',
                        )}
                        style={{ top: n.row * ROW_H, height: ROW_H, paddingLeft: graphWidth + 8 }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                          {n.branches.map((r) => <RefPill key={r.name} refInfo={r} color={laneColorOf(r)} />)}
                          {n.tags.map((r) => <RefPill key={r.name} refInfo={r} color={laneColorOf(r)} />)}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium leading-none text-background">
                              <CircleDot className="h-3 w-3" /> current
                            </span>
                          )}
                          <OpLabel operation={n.snap.operation} />
                          {added && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+{Number(added).toLocaleString()} rows</span>}
                        </div>
                        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{shortId(n.snap.snapshotId)}</span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground" title={new Date(n.snap.timestamp).toLocaleString()}>
                          {relativeTime(n.snap.timestamp)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {layout.lanes.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {layout.lanes.map((l) => (
                  <span key={l.index} className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-0.5 w-4 rounded"
                      style={{ background: l.color, opacity: l.kind === 'detached' ? 0.6 : 1 }}
                    />
                    {l.kind === 'tag' ? `tag ${l.label}` : l.label}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel: selected snapshot (+ Nessie references) */}
        <div className="space-y-4">
          {selected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitCommitHorizontal className="h-4 w-4" style={{ color: selected.lane.color }} /> Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="break-all font-mono text-xs">{selected.snap.snapshotId}</dd>
                  <dt className="text-muted-foreground">Parent</dt>
                  <dd className="break-all font-mono text-xs">
                    {selected.snap.parentSnapshotId ?? '—'}
                    {selected.snap.parentSnapshotId && !byId.has(selected.snap.parentSnapshotId) && (
                      <span className="ml-1 font-sans text-muted-foreground">(expired)</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Line</dt>
                  <dd>{selected.lane.kind === 'tag' ? `tag ${selected.lane.label}` : selected.lane.label}</dd>
                  <dt className="text-muted-foreground">Operation</dt>
                  <dd><OpLabel operation={selected.snap.operation} /></dd>
                  <dt className="text-muted-foreground">Committed</dt>
                  <dd>{new Date(selected.snap.timestamp).toLocaleString()}</dd>
                </dl>
                {Object.keys(selected.snap.summary).length > 0 && (
                  <div className="space-y-1 rounded-md border p-2">
                    {Object.entries(selected.snap.summary).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 text-xs">
                        <span className="shrink-0 font-mono text-muted-foreground">{k}</span>
                        <span className="min-w-0 break-all text-right font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {data.nessieRef && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="h-4 w-4 text-sky-500" /> Nessie references
                  <Badge variant="secondary" className="ml-1">{data.nessieReferences.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.nessieReferences.length === 0 && (
                  <p className="text-sm text-muted-foreground">Could not list the catalog references.</p>
                )}
                {data.nessieReferences.map((r) => (
                  <div
                    key={`${r.type}-${r.name}`}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm',
                      r.name === data.nessieRef && 'bg-sky-500/10',
                    )}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {r.type === 'TAG' ? <Tag className="h-3.5 w-3.5 text-amber-500" /> : <GitBranch className="h-3.5 w-3.5 text-sky-500" />}
                      <span className="truncate">{r.name}</span>
                      {r.name === data.nessieRef && <Badge className="border-0 bg-sky-500/15 text-sky-600 dark:text-sky-400">active</Badge>}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{r.hash?.slice(0, 8)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

type ListView = 'branches' | 'tags' | 'snapshots';

function RefsTable({ refs, kind, byId, colorOf, onShow }: {
  refs: TableRef[];
  kind: 'branches' | 'tags';
  byId: Map<string, SnapshotInfo>;
  colorOf: (r: TableRef) => string;
  onShow: (snapshotId: string) => void;
}) {
  if (refs.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No {kind} on this table.</p>;
  }
  return (
    <UiTable>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Head snapshot</TableHead>
          <TableHead>Committed</TableHead>
          <TableHead>Ref max age</TableHead>
          {kind === 'branches' && <TableHead>Snapshot max age</TableHead>}
          {kind === 'branches' && <TableHead>Min snapshots</TableHead>}
          <TableHead className="text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {refs.map((r) => {
          const head = byId.get(r.snapshotId);
          return (
            <TableRow key={r.name}>
              <TableCell><RefPill refInfo={r} color={colorOf(r)} /></TableCell>
              <TableCell className="font-mono text-xs">{r.snapshotId}</TableCell>
              <TableCell className="text-muted-foreground" title={head ? new Date(head.timestamp).toLocaleString() : undefined}>
                {head ? relativeTime(head.timestamp) : 'snapshot expired'}
              </TableCell>
              <TableCell>{formatDuration(r.maxRefAgeMs)}</TableCell>
              {kind === 'branches' && <TableCell>{formatDuration(r.maxSnapshotAgeMs)}</TableCell>}
              {kind === 'branches' && <TableCell>{r.minSnapshotsToKeep ?? 'table default'}</TableCell>}
              <TableCell className="text-right">
                <Button variant="outline" size="sm" disabled={!head} onClick={() => onShow(r.snapshotId)}>
                  Show in graph
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </UiTable>
  );
}

function SummaryTile({ icon, label, value, onClick, active }: {
  icon: ReactNode;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <CardContent className="flex items-center justify-between py-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
      {icon}
    </CardContent>
  );
  if (!onClick) return <Card>{body}</Card>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className={cn('h-full transition-colors hover:bg-muted/50', active && 'ring-2 ring-primary')}>{body}</Card>
    </button>
  );
}
