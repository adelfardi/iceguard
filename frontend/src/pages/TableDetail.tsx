import React from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tableApi, maintenanceApi, alertApi, executionApi, sparkClusterApi, apiErrorMessage } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Database, Columns3, Grid3x3, FileText, Camera, BarChart3, Wrench, Loader2,
  Trash2, Pencil, Plus, RefreshCw, TableIcon, Eye, HardDrive, FileStack, Clock3, MoreVertical,
  Bell, AlertTriangle, CheckCircle2, Mail, History, Activity,
  Layers, ChevronRight, ArrowLeft, Search, Gauge,
  Network, GitCompare, ArrowRight, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { MaintenanceRequest, SnapshotInfo, AlertRuleResponse, ExecutionInfo } from '@/types';
import { AlertRuleForm } from './Alerts';
import { OperationOutputDialog } from '@/components/OperationOutputDialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { SchemaEvolutionCard, SchemaDiffGraphic } from '@/components/lineage/SchemaEvolutionView';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const ICEBERG_TYPES = [
  'string','long','int','double','float','boolean','date','timestamp','timestamptz','decimal','binary','uuid',
] as const;

const COLORS = {
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7',
  emerald: '#10b981', teal: '#14b8a6', amber: '#f59e0b', rose: '#f43f5e',
  cyan: '#06b6d4', sky: '#0ea5e9', lime: '#84cc16', orange: '#f97316',
};

export function TableDetail() {
  const { catalogId, namespace, table } = useParams<{ catalogId: string; namespace: string; table: string }>();
  const catId = Number(catalogId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  const { data: tableDetail, isLoading } = useQuery({
    queryKey: ['table', catId, namespace, table],
    queryFn: () => tableApi.get(catId, namespace!, table!),
  });
  const { data: stats } = useQuery({
    queryKey: ['table-stats', catId, namespace, table],
    queryFn: () => tableApi.getStatistics(catId, namespace!, table!),
  });
  const { data: snapshots } = useQuery({
    queryKey: ['snapshots', catId, namespace, table],
    queryFn: () => tableApi.listSnapshots(catId, namespace!, table!),
  });

  const { data: tableAlertEvents } = useQuery({
    queryKey: ['alert-events-table', catId, namespace, table],
    queryFn: () => alertApi.listEvents(100),
    select: (events) => events.filter((e) => {
      const ref = e.tableRef;
      return ref.includes(namespace!) && ref.includes(table!);
    }),
  });
  const triggeredAlertCount = tableAlertEvents?.filter((e) => e.status === 'TRIGGERED').length ?? 0;

  const deleteMutation = useMutation({
    mutationFn: () => tableApi.drop(catId, namespace!, table!),
    onSuccess: () => { toast.success('Table deleted'); queryClient.invalidateQueries({ queryKey: ['tables', catId, namespace] }); navigate(`/catalogs/${catId}`); },
    onError: (err: Error) => toast.error(`Failed to delete table: ${apiErrorMessage(err)}`),
  });
  const renameMutation = useMutation({
    mutationFn: (newName: string) => tableApi.rename(catId, namespace!, table!, { newName }),
    onSuccess: (_data, newName) => { toast.success(`Table renamed to ${newName}`); queryClient.invalidateQueries({ queryKey: ['tables', catId, namespace] }); setRenameDialogOpen(false); navigate(`/catalogs/${catId}/namespaces/${namespace}/tables/${newName}`); },
    onError: (err: Error) => toast.error(`Failed to rename: ${apiErrorMessage(err)}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative shrink-0">
            <div className="flex h-14 w-14 items-center justify-center">
              <img
                src="/ice.png"
                alt="IceGuard"
                className="h-14 w-14 rounded-lg object-contain"
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-indigo-500 text-[9px] font-bold text-white">
              v{tableDetail?.formatVersion}
            </span>
          </div>
          <div className="min-w-0 space-y-1.5 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              Iceberg table
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl leading-tight">
              <span className="font-medium text-muted-foreground">{namespace}</span>
              <span className="mx-0.5 font-normal text-muted-foreground/50">.</span>
              <span className="bg-gradient-to-r from-foreground via-foreground to-indigo-600/90 bg-clip-text text-transparent dark:to-indigo-400/90">
                {table}
              </span>
            </h1>
            {tableDetail?.location && (
              <p
                className="max-w-xl truncate font-mono text-xs text-muted-foreground/90 sm:max-w-2xl"
                title={tableDetail.location}
              >
                {tableDetail.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Table actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => {
                  setNewTableName(table ?? '');
                  setRenameDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onSelect={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Rename Table</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (newTableName.trim()) renameMutation.mutate(newTableName.trim()); }} className="space-y-4">
                <div className="space-y-2"><Label>New Table Name</Label><Input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} required /></div>
                <Button type="submit" disabled={renameMutation.isPending}>{renameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rename</Button>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Table</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete <strong>{namespace}.{table}</strong>? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate()}>{deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatMiniCard label="Snapshots" value={stats.snapshotCount} icon={<Camera className="h-4 w-4" />} color="text-violet-500" />
          <StatMiniCard label="Data Files" value={stats.totalDataFiles.toLocaleString()} icon={<HardDrive className="h-4 w-4" />} color="text-emerald-500" />
          <StatMiniCard label="Total Size" value={formatBytes(stats.totalDataSizeBytes)} icon={<Database className="h-4 w-4" />} color="text-foreground" />
          <StatMiniCard label="Records" value={stats.totalRecords.toLocaleString()} icon={<FileStack className="h-4 w-4" />} color="text-foreground" />
          <StatMiniCard label="Delete Files" value={stats.totalDeleteFiles.toLocaleString()} icon={<Trash2 className="h-4 w-4" />} color="text-rose-500" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          <TabsList className="inline-flex w-max min-w-full bg-muted/50 h-auto flex-wrap sm:flex-nowrap">
          <TabsTrigger value="overview"><Eye className="mr-1.5 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="schema"><Columns3 className="mr-1.5 h-4 w-4 text-blue-500" /> Schema</TabsTrigger>
          <TabsTrigger value="partitions"><Grid3x3 className="mr-1.5 h-4 w-4" /> Partitions</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="mr-1.5 h-4 w-4 text-cyan-500" /> Storage</TabsTrigger>
          <TabsTrigger value="properties"><FileText className="mr-1.5 h-4 w-4" /> Properties</TabsTrigger>
          <TabsTrigger value="snapshots"><Camera className="mr-1.5 h-4 w-4 text-violet-500" /> Snapshots</TabsTrigger>
          <TabsTrigger value="data"><TableIcon className="mr-1.5 h-4 w-4 text-emerald-500" /> Data</TabsTrigger>
          <TabsTrigger value="timeline"><History className="mr-1.5 h-4 w-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="lineage"><Network className="mr-1.5 h-4 w-4 text-fuchsia-500" /> Lineage</TabsTrigger>
          <TabsTrigger value="maintenance"><Wrench className="mr-1.5 h-4 w-4" /> Maintenance</TabsTrigger>
          <TabsTrigger value="alerts">
            <span className="relative mr-1.5">
              <Bell className="h-4 w-4 text-amber-500" />
              {triggeredAlertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{triggeredAlertCount > 9 ? '9+' : triggeredAlertCount}</span>
              )}
            </span>
            Alerts
          </TabsTrigger>
        </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab stats={stats!} snapshots={snapshots ?? []} catalogId={catId} namespace={namespace!} table={table!} />
        </TabsContent>

        {/* ── Schema ── */}
        <TabsContent value="schema" className="mt-4">
          <SchemaTab catalogId={catId} namespace={namespace!} table={table!} tableDetail={tableDetail!} />
        </TabsContent>

        {/* ── Partitions ── */}
        <TabsContent value="partitions" className="mt-4">
          <PartitionsTab catalogId={catId} namespace={namespace!} table={table!} tableDetail={tableDetail!} />
        </TabsContent>

        {/* ── Storage ── */}
        <TabsContent value="storage" className="mt-4">
          <StorageTab catalogId={catId} namespace={namespace!} table={table!} />
        </TabsContent>

        {/* ── Properties ── */}
        <TabsContent value="properties" className="mt-4">
          <PropertiesTab catalogId={catId} namespace={namespace!} table={table!} tableDetail={tableDetail!} />
        </TabsContent>

        {/* ── Snapshots ── */}
        <TabsContent value="snapshots" className="mt-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-violet-500" /> Snapshots <Badge className="bg-violet-500/10 text-violet-400 border-0 ml-2">{snapshots?.length ?? 0}</Badge></CardTitle></CardHeader>
            <CardContent>
              {snapshots?.length === 0 ? <p className="text-muted-foreground py-4 text-center">No snapshots</p> : (
                <UiTable><TableHeader><TableRow><TableHead>Snapshot ID</TableHead><TableHead>Timestamp</TableHead><TableHead>Operation</TableHead><TableHead>Added Files</TableHead><TableHead>Added Records</TableHead></TableRow></TableHeader>
                  <TableBody>{snapshots?.map((snap) => (
                    <TableRow key={snap.snapshotId}>
                      <TableCell className="font-mono text-sm text-blue-400">{snap.snapshotId}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(snap.timestamp).toLocaleString()}</TableCell>
                      <TableCell><Badge className="bg-violet-500/10 text-violet-400 border-0">{snap.operation}</Badge></TableCell>
                      <TableCell className="text-emerald-400 font-medium">{snap.summary['added-data-files'] ?? '-'}</TableCell>
                      <TableCell className="text-amber-400 font-medium">{snap.summary['added-records'] ?? '-'}</TableCell>
                    </TableRow>
                  ))}</TableBody></UiTable>)}
            </CardContent></Card>
        </TabsContent>

        {/* ── Data ── */}
        <TabsContent value="data" className="mt-4"><DataSampleTab catalogId={catId} namespace={namespace!} table={table!} /></TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab catalogId={catId} namespace={namespace!} table={table!} snapshots={snapshots ?? []} />
        </TabsContent>

        {/* ── Lineage ── */}
        <TabsContent value="lineage" className="mt-4">
          <LineageTab catalogId={catId} namespace={namespace!} table={table!} snapshots={snapshots ?? []} />
        </TabsContent>

        {/* ── Maintenance ── */}
        <TabsContent value="maintenance" className="mt-4"><MaintenanceTab catalogId={catId} namespace={namespace!} table={table!} /></TabsContent>

        {/* ── Alerts ── */}
        <TabsContent value="alerts" className="mt-4"><AlertsTab catalogId={catId} namespace={namespace!} table={table!} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════ Overview Tab ═══════════════════════ */

const DATA_FILES_THRESHOLD = 100;
const SNAPSHOT_THRESHOLD = 50;

function OverviewTab({ stats, snapshots, catalogId, namespace, table }: {
  stats: import('@/types').TableStatistics | undefined;
  snapshots: SnapshotInfo[];
  catalogId: number;
  namespace: string;
  table: string;
}) {
  // Hooks must run unconditionally — keep this above the early return below.
  const { data: recentExecutions } = useQuery({
    queryKey: ['table-recent-executions', catalogId, namespace, table],
    queryFn: () => executionApi.search({ catalogId, namespace, table, size: 6, page: 0 }),
  });

  if (!stats) return <Skeleton className="h-96 w-full" />;

  const dataFilesPie = [
    { name: 'Data Files', value: stats.totalDataFiles, color: stats.totalDataFiles > DATA_FILES_THRESHOLD ? COLORS.rose : COLORS.emerald },
    { name: 'Remaining', value: Math.max(0, DATA_FILES_THRESHOLD - stats.totalDataFiles), color: '#e5e7eb' },
  ];

  const snapshotsPie = [
    { name: 'Snapshots', value: stats.snapshotCount, color: stats.snapshotCount > SNAPSHOT_THRESHOLD ? COLORS.amber : COLORS.blue },
    { name: 'Remaining', value: Math.max(0, SNAPSHOT_THRESHOLD - stats.snapshotCount), color: '#e5e7eb' },
  ];

  const snapshotsByHour = snapshots.reduce((acc, s) => {
    const hour = new Date(s.timestamp).getHours();
    const label = `${hour.toString().padStart(2, '0')}:00`;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const label = `${h.toString().padStart(2, '0')}:00`;
    return { hour: label, commits: snapshotsByHour[label] ?? 0 };
  });

  const latestActions = recentExecutions?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Commits by hour */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-amber-500" /> Commits by Hour</CardTitle></CardHeader>
          <CardContent>
            {snapshots.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No snapshots yet</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} className="fill-muted-foreground" interval={2} />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="commits" radius={[4, 4, 0, 0]}>
                    {hourlyData.map((entry, i) => <Cell key={i} fill={entry.commits > 0 ? COLORS.amber : '#e5e7eb'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Snapshots Gauge */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2 text-sm"><Camera className="h-4 w-4 text-violet-500" /> Snapshots vs Threshold</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={snapshotsPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                  {snapshotsPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">{stats.snapshotCount}</text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">/ {SNAPSHOT_THRESHOLD}</text>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Data Files Gauge */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2 text-sm"><HardDrive className="h-4 w-4 text-emerald-500" /> Data Files vs Threshold</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={dataFilesPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                  {dataFilesPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">{stats.totalDataFiles}</text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">/ {DATA_FILES_THRESHOLD}</text>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latest Actions */}
        <Card>
          <CardHeader className="pb-0 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" /> Latest Actions</CardTitle>
            {latestActions.length > 0 && (
              <Link
                to={`/executions?catalogId=${catalogId}&namespace=${encodeURIComponent(namespace)}&table=${encodeURIComponent(table)}`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {latestActions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-2" />
                <p>No executions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {latestActions.map((exec) => (
                  <div key={exec.id} className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-accent transition-all duration-150">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{exec.namespace}.{exec.tableName}</p>
                      <p className="text-xs text-muted-foreground">{exec.actionType}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={exec.status} />
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {formatExecDuration(exec.startedAt, exec.finishedAt)}
                        <span className="opacity-50">·</span>
                        {formatExecTime(exec.startedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════ Schema Tab ═══════════════════════ */

interface ColDraft {
  key: string;
  id: number | null;
  origName: string | null; origType: string | null; origRequired: boolean | null; origDoc: string | null;
  name: string; type: string; required: boolean; doc: string;
  deleted: boolean;
}

function SchemaTab({ catalogId, namespace, table, tableDetail }: {
  catalogId: number; namespace: string; table: string; tableDetail: import('@/types').TableDetail;
}) {
  const queryClient = useQueryClient();
  const cols = tableDetail.schema.columns;
  const build = (): ColDraft[] => cols.map((c) => ({
    key: `c${c.id}`, id: c.id,
    origName: c.name, origType: c.type, origRequired: c.required, origDoc: c.doc ?? '',
    name: c.name, type: c.type, required: c.required, doc: c.doc ?? '', deleted: false,
  }));
  const [draft, setDraft] = useState<ColDraft[]>(build);
  const sig = JSON.stringify(cols.map((c) => [c.id, c.name, c.type, c.required, c.doc]));
  React.useEffect(() => { setDraft(build()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sig]);

  // Build a single SchemaUpdateRequest from the staged edits.
  const req: import('@/types').SchemaUpdateRequest = {};
  const addColumns: NonNullable<typeof req.addColumns> = [];
  const dropColumns: string[] = [];
  const renameColumns: NonNullable<typeof req.renameColumns> = [];
  const updateColumns: NonNullable<typeof req.updateColumns> = [];
  for (const d of draft) {
    if (d.id === null) {
      if (!d.deleted && d.name.trim()) addColumns.push({ name: d.name.trim(), type: d.type, required: d.required, doc: d.doc || undefined });
      continue;
    }
    if (d.deleted) { dropColumns.push(d.origName!); continue; }
    if (d.name.trim() !== d.origName) renameColumns.push({ oldName: d.origName!, newName: d.name.trim() });
    const upd: { name: string; newType?: string; doc?: string; required?: boolean } = { name: d.origName! };
    let changed = false;
    if (d.type !== d.origType) { upd.newType = d.type; changed = true; }
    if ((d.doc || '') !== (d.origDoc || '')) { upd.doc = d.doc; changed = true; }
    if (d.required !== d.origRequired) { upd.required = d.required; changed = true; }
    if (changed) updateColumns.push(upd);
  }
  if (addColumns.length) req.addColumns = addColumns;
  if (dropColumns.length) req.dropColumns = dropColumns;
  if (renameColumns.length) req.renameColumns = renameColumns;
  if (updateColumns.length) req.updateColumns = updateColumns;
  const pending = addColumns.length + dropColumns.length + renameColumns.length + updateColumns.length;

  const saveMutation = useMutation({
    mutationFn: () => tableApi.updateSchema(catalogId, namespace, table, req),
    onSuccess: () => { toast.success('Schema updated'); queryClient.invalidateQueries({ queryKey: ['table', catalogId, namespace, table] }); },
    onError: (err) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const patch = (key: string, p: Partial<ColDraft>) => setDraft((ds) => ds.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const addCol = () => setDraft((ds) => [...ds, { key: crypto.randomUUID(), id: null, origName: null, origType: null, origRequired: null, origDoc: null, name: '', type: 'string', required: false, doc: '', deleted: false }]);
  const removeNew = (key: string) => setDraft((ds) => ds.filter((d) => d.key !== key));
  const reset = () => setDraft(build());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Columns3 className="h-5 w-5 text-blue-500" /> Schema <span className="text-muted-foreground text-sm font-normal">(ID: {tableDetail.schema.schemaId})</span></span>
          <div className="flex items-center gap-2">
            {pending > 0 && <Badge className="bg-amber-500/10 text-amber-400 border-0">+{addColumns.length} ~{updateColumns.length + renameColumns.length} −{dropColumns.length}</Badge>}
            <Button size="sm" variant="outline" onClick={addCol}><Plus className="mr-1 h-4 w-4" /> Add Column</Button>
            {pending > 0 && <Button size="sm" variant="ghost" onClick={reset} disabled={saveMutation.isPending}>Reset</Button>}
            <Button size="sm" disabled={pending === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save changes
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UiTable>
          <TableHeader><TableRow><TableHead className="w-14">ID</TableHead><TableHead>Name</TableHead><TableHead className="w-40">Type</TableHead><TableHead className="w-24">Required</TableHead><TableHead>Doc</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>{draft.map((d) => {
            const isNew = d.id === null;
            const rowChanged = isNew || d.deleted || d.name.trim() !== d.origName || d.type !== d.origType || d.required !== d.origRequired || (d.doc || '') !== (d.origDoc || '');
            return (
              <TableRow key={d.key} className={cn(d.deleted && 'opacity-50', isNew && 'bg-emerald-500/[0.05]', !isNew && !d.deleted && rowChanged && 'bg-amber-500/[0.05]')}>
                <TableCell className="font-mono text-xs text-muted-foreground">{isNew ? <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">new</Badge> : d.id}</TableCell>
                <TableCell>
                  <Input value={d.name} disabled={d.deleted} onChange={(e) => patch(d.key, { name: e.target.value })} className={cn('h-8 text-sm', d.deleted && 'line-through')} placeholder="column_name" />
                </TableCell>
                <TableCell>
                  <Select value={d.type} disabled={d.deleted} onValueChange={(v) => patch(d.key, { type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ICEBERG_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}{!ICEBERG_TYPES.includes(d.type as typeof ICEBERG_TYPES[number]) && <SelectItem value={d.type}>{d.type}</SelectItem>}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="rounded" checked={d.required} disabled={d.deleted} onChange={(e) => patch(d.key, { required: e.target.checked })} />required</label>
                </TableCell>
                <TableCell>
                  <Input value={d.doc} disabled={d.deleted} onChange={(e) => patch(d.key, { doc: e.target.value })} className="h-8 text-sm" placeholder="—" />
                </TableCell>
                <TableCell>
                  {isNew ? (
                    <Button variant="ghost" size="sm" title="Remove" onClick={() => removeNew(d.key)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  ) : d.deleted ? (
                    <Button variant="ghost" size="sm" title="Restore" onClick={() => patch(d.key, { deleted: false })}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  ) : (
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => patch(d.key, { deleted: true })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </UiTable>
        <p className="text-xs text-muted-foreground mt-3">Add, rename, retype, toggle required, edit docs and delete columns — everything is applied in a <strong>single commit</strong> when you save. (Some changes like incompatible type changes may be rejected by Iceberg.)</p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════ Properties Tab ═══════════════════════ */

interface PropRow { id: string; key: string; value: string; origKey: string | null }

function PropertiesTab({ catalogId, namespace, table, tableDetail }: {
  catalogId: number; namespace: string; table: string; tableDetail: import('@/types').TableDetail;
}) {
  const queryClient = useQueryClient();
  const props = tableDetail.properties ?? {};
  const buildRows = (): PropRow[] => Object.entries(props).map(([k, v]) => ({ id: k, key: k, value: v, origKey: k }));
  const [rows, setRows] = useState<PropRow[]>(buildRows);
  const sig = JSON.stringify(props);
  // Resync when the underlying properties change (after a successful save / table reload).
  React.useEffect(() => { setRows(buildRows()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sig]);

  const origKeys = Object.keys(props);
  const set: Record<string, string> = {};
  for (const r of rows) {
    const key = r.key.trim();
    if (!key) continue;
    if (r.origKey === null) set[key] = r.value;            // new
    else if (props[r.origKey] !== r.value) set[key] = r.value; // changed value
  }
  const presentOrig = new Set(rows.filter((r) => r.origKey !== null).map((r) => r.origKey as string));
  const remove = origKeys.filter((k) => !presentOrig.has(k));
  const dirty = Object.keys(set).length > 0 || remove.length > 0;

  const saveMutation = useMutation({
    mutationFn: () => tableApi.updateProperties(catalogId, namespace, table, set, remove),
    onSuccess: () => { toast.success('Properties saved'); queryClient.invalidateQueries({ queryKey: ['table', catalogId, namespace, table] }); },
    onError: (err) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const updateRow = (id: string, patch: Partial<PropRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () => setRows((rs) => [...rs, { id: crypto.randomUUID(), key: '', value: '', origKey: null }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-amber-500" /> Table Properties</span>
          <div className="flex items-center gap-2">
            {dirty && <Badge className="bg-amber-500/10 text-amber-400 border-0">{Object.keys(set).length} set · {remove.length} remove</Badge>}
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="mr-1 h-4 w-4" /> Add</Button>
            <Button size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save changes
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-center text-muted-foreground py-6 text-sm">No properties. Click <strong>Add</strong> to create one.</p> : (
          <UiTable>
            <TableHeader><TableRow><TableHead className="w-1/3">Key</TableHead><TableHead>Value</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const changed = r.origKey === null || props[r.origKey] !== r.value;
                return (
                  <TableRow key={r.id} className={changed ? 'bg-amber-500/[0.04]' : undefined}>
                    <TableCell>
                      {r.origKey !== null
                        ? <span className="font-mono text-sm text-violet-400">{r.key}</span>
                        : <Input value={r.key} onChange={(e) => updateRow(r.id, { key: e.target.value })} placeholder="property.key" className="h-8 font-mono text-xs" />}
                    </TableCell>
                    <TableCell>
                      <Input value={r.value} onChange={(e) => updateRow(r.id, { value: e.target.value })} className="h-8 font-mono text-xs" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" title="Remove" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </UiTable>
        )}
        <p className="text-xs text-muted-foreground mt-3">All additions, edits and removals are applied in a <strong>single commit</strong> when you save.</p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════ Partitions Tab ═══════════════════════ */

const PARTITION_TRANSFORMS = ['identity', 'year', 'month', 'day', 'hour', 'bucket', 'truncate'] as const;

function PartitionsTab({ catalogId, namespace, table, tableDetail }: {
  catalogId: number; namespace: string; table: string; tableDetail: import('@/types').TableDetail;
}) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeField, setRemoveField] = useState<string | null>(null);
  const [transform, setTransform] = useState<string>('identity');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['table', catalogId, namespace, table] });

  const addMutation = useMutation({
    mutationFn: (field: { sourceColumn: string; transform: string; name?: string }) =>
      tableApi.updatePartitionSpec(catalogId, namespace, table, { addFields: [field] }),
    onSuccess: () => { toast.success('Partition field added'); invalidate(); setAddOpen(false); setTransform('identity'); },
    onError: (err: Error) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });
  const removeMutation = useMutation({
    mutationFn: (name: string) =>
      tableApi.updatePartitionSpec(catalogId, namespace, table, { removeFields: [name] }),
    onSuccess: () => { toast.success('Partition field removed'); invalidate(); setRemoveField(null); },
    onError: (err: Error) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const needsWidth = transform === 'bucket' || transform === 'truncate';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Grid3x3 className="h-5 w-5 text-teal-500" /> Partition Spec</span>
          <div className="flex items-center gap-2">
            <Badge className="bg-teal-500/10 text-teal-400 border-0">{tableDetail.partitionSpec.length} fields</Badge>
            <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setTransform('identity'); }}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> Add Field</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Partition Field</DialogTitle></DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const sourceColumn = fd.get('sourceColumn') as string;
                    const t = fd.get('transform') as string;
                    const name = (fd.get('name') as string).trim();
                    let transformStr = t;
                    if (t === 'bucket' || t === 'truncate') {
                      const width = parseInt(fd.get('width') as string, 10);
                      if (!width || width <= 0) { toast.error('Enter a valid width/bucket count'); return; }
                      transformStr = `${t}[${width}]`;
                    }
                    if (!sourceColumn) return;
                    addMutation.mutate({ sourceColumn, transform: transformStr, name: name || undefined });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2"><Label>Source Column</Label>
                    <Select name="sourceColumn" defaultValue={tableDetail.schema.columns[0]?.name}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{tableDetail.schema.columns.map((c) => <SelectItem key={c.id} value={c.name}>{c.name} <span className="text-muted-foreground">({c.type})</span></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Transform</Label>
                    <Select name="transform" value={transform} onValueChange={setTransform}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{PARTITION_TRANSFORMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {needsWidth && (
                    <div className="space-y-2"><Label>{transform === 'bucket' ? 'Number of buckets' : 'Truncate width'}</Label><Input name="width" type="number" min={1} defaultValue={transform === 'bucket' ? 16 : 10} /></div>
                  )}
                  <div className="space-y-2"><Label>Partition Name <span className="text-muted-foreground">(optional)</span></Label><Input name="name" placeholder="defaults to source__transform" /></div>
                  <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Field</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tableDetail.partitionSpec.length === 0 ? <p className="text-muted-foreground py-4 text-center">Unpartitioned table</p> : (
          <UiTable>
            <TableHeader><TableRow><TableHead>Field Name</TableHead><TableHead>Source Column</TableHead><TableHead>Transform</TableHead><TableHead>Source ID</TableHead><TableHead className="w-16">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{tableDetail.partitionSpec.map((pf) => (
              <TableRow key={pf.name}>
                <TableCell className="font-medium text-foreground">{pf.name}</TableCell>
                <TableCell className="text-sky-400">{pf.sourceColumn}</TableCell>
                <TableCell><Badge className="bg-teal-500/10 text-teal-400 border-0">{pf.transform}</Badge></TableCell>
                <TableCell className="font-mono text-muted-foreground">{pf.sourceId}</TableCell>
                <TableCell>
                  <AlertDialog open={removeField === pf.name} onOpenChange={(open) => setRemoveField(open ? pf.name : null)}>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" title="Remove"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Partition Field</AlertDialogTitle><AlertDialogDescription>Remove partition field <strong>{pf.name}</strong>? Existing data files keep their old layout; new writes use the updated spec.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => removeMutation.mutate(pf.name)}>{removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </UiTable>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════ Data Sample Tab ═══════════════════════ */

const ROW_LIMITS = [10, 25, 50, 100, 500] as const;

function DataSampleTab({ catalogId, namespace, table }: { catalogId: number; namespace: string; table: string }) {
  const [limit, setLimit] = useState(100);
  const { data: sample, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['table-sample', catalogId, namespace, table, limit],
    queryFn: () => tableApi.sampleData(catalogId, namespace, table, limit),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><TableIcon className="h-5 w-5 text-emerald-500" /> Data Sample</span>
          <div className="flex items-center gap-2">
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROW_LIMITS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        : !sample || sample.rows.length === 0 ? <div className="text-center py-8 text-muted-foreground"><TableIcon className="mx-auto h-8 w-8 mb-2" /><p>No data available</p></div>
        : <div>
            <div className="text-xs text-muted-foreground mb-2">
              Showing <span className="font-semibold text-foreground">{sample.rows.length}</span> of {sample.rowCount} rows{sample.hasMore && ' (more available)'}
            </div>
            <ScrollArea className="w-full"><div className="min-w-max"><UiTable><TableHeader><TableRow>{sample.columns.map((col) => <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{sample.rows.map((row, idx) => <TableRow key={idx}>{sample.columns.map((col) => <TableCell key={col} className="font-mono text-xs whitespace-nowrap">{row[col] === null || row[col] === undefined ? <span className="text-muted-foreground italic">null</span> : String(row[col])}</TableCell>)}</TableRow>)}</TableBody>
            </UiTable></div><ScrollBar orientation="horizontal" /></ScrollArea>
          </div>}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════ Maintenance Tab ═══════════════════════ */

function MaintenanceTab({ catalogId, namespace, table }: { catalogId: number; namespace: string; table: string }) {
  const queryClient = useQueryClient();
  const [expireOpen, setExpireOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rewriteDataOpen, setRewriteDataOpen] = useState(false);
  const [rewriteManifestsOpen, setRewriteManifestsOpen] = useState(false);
  const [removeOrphansOpen, setRemoveOrphansOpen] = useState(false);
  const [rewriteEngine, setRewriteEngine] = useState<'java' | 'spark'>('java');
  const [rewriteCluster, setRewriteCluster] = useState<string>('local');

  const { data: sparkClusters } = useQuery({ queryKey: ['spark-clusters'], queryFn: sparkClusterApi.list });

  const invalidateAll = () => { queryClient.invalidateQueries({ queryKey: ['snapshots', catalogId, namespace, table] }); queryClient.invalidateQueries({ queryKey: ['table-stats', catalogId, namespace, table] }); queryClient.invalidateQueries({ queryKey: ['table', catalogId, namespace, table] }); };

  const makeMutation = (fn: (r: MaintenanceRequest) => Promise<unknown>, label: string, close: () => void) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({ mutationFn: fn, onSuccess: () => { toast.success(`${label}: success`); invalidateAll(); close(); }, onError: (err: Error) => toast.error(`${label}: ${apiErrorMessage(err)}`) });

  const expireM = makeMutation((r) => maintenanceApi.expireSnapshots(catalogId, namespace, table, r), 'Expire', () => setExpireOpen(false));
  const rollbackM = makeMutation((r) => maintenanceApi.rollback(catalogId, namespace, table, r), 'Rollback', () => setRollbackOpen(false));
  const rewriteDataM = makeMutation((r) => maintenanceApi.rewriteDataFiles(catalogId, namespace, table, r), 'Rewrite data', () => setRewriteDataOpen(false));
  const rewriteManifestsM = makeMutation((r) => maintenanceApi.rewriteManifests(catalogId, namespace, table, r), 'Rewrite manifests', () => setRewriteManifestsOpen(false));
  const removeOrphansM = makeMutation((r) => maintenanceApi.removeOrphanFiles(catalogId, namespace, table, r), 'Remove orphans', () => setRemoveOrphansOpen(false));

  const actionCard = (title: string, desc: string, icon: React.ReactNode, color: string, dialogOpen: boolean, setOpen: (b: boolean) => void, content: React.ReactNode) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground mb-3">{desc}</p>
        <Dialog open={dialogOpen} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm">{icon}<span className="ml-1">Run</span></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{content}</DialogContent></Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {actionCard('Expire Snapshots', 'Remove old snapshots to reclaim storage.', <Camera className="h-4 w-4 text-violet-500" />, 'border-l-violet-500', expireOpen, setExpireOpen,
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const req: MaintenanceRequest = {}; const h = fd.get('h') as string; if (h) req.olderThanMs = Number(h)*3600000; const r = fd.get('r') as string; if (r) req.retainLast = Number(r); expireM.mutate(req); }} className="space-y-4">
          <div className="space-y-2"><Label>Older than (hours)</Label><Input name="h" type="number" placeholder="168" /></div>
          <div className="space-y-2"><Label>Retain last N</Label><Input name="r" type="number" placeholder="5" /></div>
          <Button type="submit" variant="destructive" disabled={expireM.isPending}>{expireM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Expire</Button>
        </form>
      )}
      {actionCard('Rollback', 'Roll back to a specific snapshot.', <Clock3 className="h-4 w-4 text-blue-500" />, 'border-l-blue-500', rollbackOpen, setRollbackOpen,
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); rollbackM.mutate({ snapshotId: (fd.get('sid') as string).trim() }); }} className="space-y-4">
          <div className="space-y-2"><Label>Snapshot ID</Label><Input name="sid" type="number" required /></div>
          <Button type="submit" variant="destructive" disabled={rollbackM.isPending}>{rollbackM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rollback</Button>
        </form>
      )}
      {actionCard('Rewrite Data Files', 'Compact small files for better performance.', <HardDrive className="h-4 w-4 text-emerald-500" />, 'border-l-emerald-500', rewriteDataOpen, setRewriteDataOpen,
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const req: MaintenanceRequest = {}; const ts = fd.get('ts') as string; const mi = fd.get('mi') as string; if (ts || mi) { req.parameters = {}; if (ts) req.parameters['target-file-size-bytes'] = String(Number(ts)*1048576); if (mi) req.parameters['min-input-files'] = mi; } if (rewriteEngine === 'spark') { req.engine = 'spark'; if (rewriteCluster !== 'local') req.sparkClusterId = Number(rewriteCluster); } rewriteDataM.mutate(req); }} className="space-y-4">
          <div className="space-y-2"><Label>Engine</Label>
            <Select value={rewriteEngine} onValueChange={(v) => setRewriteEngine(v as 'java' | 'spark')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="java">Java API (analyse only)</SelectItem>
                <SelectItem value="spark">Spark (real compaction)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rewriteEngine === 'spark' && (
            <div className="space-y-2"><Label>Spark target</Label>
              <Select value={rewriteCluster} onValueChange={setRewriteCluster}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (local[*])</SelectItem>
                  {sparkClusters?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} <span className="text-muted-foreground">({c.masterUrl})</span></SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Configure clusters in Settings · Spark must be installed for execution.</p>
            </div>
          )}
          <div className="space-y-2"><Label>Target file size (MB)</Label><Input name="ts" type="number" placeholder="512" /></div>
          <div className="space-y-2"><Label>Min input files</Label><Input name="mi" type="number" placeholder="5" /></div>
          <Button type="submit" disabled={rewriteDataM.isPending}>{rewriteDataM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{rewriteEngine === 'spark' ? 'Run Spark Compaction' : 'Analyze'}</Button>
        </form>
      )}
      {actionCard('Rewrite Manifests', 'Optimize manifest files for faster queries.', <FileStack className="h-4 w-4 text-amber-500" />, 'border-l-amber-500', rewriteManifestsOpen, setRewriteManifestsOpen,
        <div className="space-y-4"><p className="text-sm text-muted-foreground">This will rewrite all manifest files. Continue?</p>
          <Button onClick={() => rewriteManifestsM.mutate({})} disabled={rewriteManifestsM.isPending}>{rewriteManifestsM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rewrite Manifests</Button>
        </div>
      )}
      {actionCard('Remove Orphan Files', 'Delete files no longer referenced by snapshots.', <Trash2 className="h-4 w-4 text-rose-500" />, 'border-l-rose-500', removeOrphansOpen, setRemoveOrphansOpen,
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const req: MaintenanceRequest = {}; const h = fd.get('h') as string; if (h) req.olderThanMs = Number(h)*3600000; removeOrphansM.mutate(req); }} className="space-y-4">
          <div className="space-y-2"><Label>Older than (hours)</Label><Input name="h" type="number" placeholder="72" /><p className="text-xs text-muted-foreground">Safety threshold to avoid deleting active files.</p></div>
          <Button type="submit" variant="destructive" disabled={removeOrphansM.isPending}>{removeOrphansM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove Orphans</Button>
        </form>
      )}
    </div>
  );
}

/* ═══════════════════════ Alerts Tab ═══════════════════════ */

const METRICS_DISPLAY: Record<string, { label: string; unit: string }> = {
  SNAPSHOT_COUNT: { label: 'Snapshot Count', unit: '' },
  DATA_FILE_COUNT: { label: 'Data File Count', unit: '' },
  TOTAL_SIZE_BYTES: { label: 'Total Size', unit: 'bytes' },
  DELETE_FILE_COUNT: { label: 'Delete File Count', unit: '' },
  TOTAL_RECORDS: { label: 'Total Records', unit: '' },
};

const OPERATORS_DISPLAY: Record<string, string> = {
  GT: '>', LT: '<', GTE: '>=', LTE: '<=', EQ: '=',
};

function AlertsTab({ catalogId, namespace, table }: { catalogId: number; namespace: string; table: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editRule, setEditRule] = useState<AlertRuleResponse | null>(null);

  const { data: allRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['alert-rules-table', catalogId, namespace, table],
    queryFn: alertApi.listRules,
    select: (rules) => rules.filter(
      (r) => r.catalogId === catalogId && r.namespace === namespace && r.tableName === table,
    ),
  });

  const { data: allEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['alert-events-table', catalogId, namespace, table],
    queryFn: () => alertApi.listEvents(100),
    select: (events) => events.filter(
      (e) => e.tableRef.includes(namespace) && e.tableRef.includes(table),
    ).slice(0, 10),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => alertApi.toggleRule(id, enabled),
    onSuccess: () => {
      toast.success('Rule toggled');
      queryClient.invalidateQueries({ queryKey: ['alert-rules-table'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertApi.deleteRule(id),
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['alert-rules-table'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => alertApi.acknowledge(id),
    onSuccess: () => {
      toast.success('Event acknowledged');
      queryClient.invalidateQueries({ queryKey: ['alert-events-table'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Alert Rules — left column */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" /> Rules
              {allRules && <Badge variant="secondary">{allRules.length}</Badge>}
            </span>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Alert Rule</DialogTitle></DialogHeader>
                <AlertRuleForm
                  catalogId={catalogId}
                  namespace={namespace}
                  tableName={table}
                  onSuccess={() => setAddOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !allRules || allRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 mb-2" />
              <p>No alert rules</p>
              <p className="text-sm">Click &quot;Add&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allRules.map((rule) => (
                <Card key={rule.id} className={`${!rule.enabled ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rule.name}</span>
                          <StatusBadge status={rule.lastStatus} kind="alert" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {METRICS_DISPLAY[rule.metric]?.label ?? rule.metric} {OPERATORS_DISPLAY[rule.operator] ?? rule.operator} {rule.threshold}
                          </Badge>
                          <span className="text-xs text-muted-foreground">every {rule.checkIntervalMinutes}m</span>
                        </div>
                        {rule.lastValue !== null && (
                          <p className="text-xs text-muted-foreground">
                            Last value: {rule.lastValue}
                            {rule.lastCheckedAt && ` (${new Date(rule.lastCheckedAt).toLocaleString()})`}
                          </p>
                        )}
                        {rule.emails.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rule.emails.map((email) => (
                              <Badge key={email} variant="secondary" className="text-xs">
                                <Mail className="mr-1 h-3 w-3" />{email}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, enabled: checked === true })
                          }
                          size="sm"
                        />
                        <Dialog open={editRule?.id === rule.id} onOpenChange={(open) => { if (open) setEditRule(rule); else setEditRule(null); }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader><DialogTitle>Edit Alert Rule</DialogTitle></DialogHeader>
                            <AlertRuleForm
                              catalogId={catalogId}
                              namespace={namespace}
                              tableName={table}
                              existingRule={rule}
                              onSuccess={() => setEditRule(null)}
                            />
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
                              <AlertDialogDescription>Delete rule &quot;{rule.name}&quot;? This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alert Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Recent Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !allEvents || allEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p>No recent alert events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-md p-3">
                  <div className="shrink-0">
                    {event.status === 'TRIGGERED' ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : event.status === 'RESOLVED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Bell className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{event.ruleName}</span>
                      <StatusBadge status={event.status} kind="alert" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {METRICS_DISPLAY[event.metric]?.label ?? event.metric}: {event.currentValue} {OPERATORS_DISPLAY[event.operator] ?? event.operator} {event.threshold}
                      {' | '}{new Date(event.triggeredAt).toLocaleString()}
                    </p>
                  </div>
                  {event.status === 'TRIGGERED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeMutation.mutate(event.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Ack
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════ Timeline Tab ═══════════════════════ */

/* Lucide icon paths (24×24, stroke = currentColor) */
const ICON_PATHS: Record<string, string> = {
  plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
  refresh:  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  repeat:   '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  trash:    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  camera:   '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  files:    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  brush:    '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  undo:     '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
  zap:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  circleX:  '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
};

const VIS_FAILED_META = { color: '#ef4444', icon: 'circleX' };

function svgIcon(name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] ?? ICON_PATHS.zap}</svg>`;
}

const VIS_META: Record<string, { color: string; icon: string }> = {
  append:              { color: '#10b981', icon: 'plus' },
  overwrite:           { color: '#3b82f6', icon: 'refresh' },
  replace:             { color: '#06b6d4', icon: 'repeat' },
  delete:              { color: '#ef4444', icon: 'trash' },
  EXPIRE_SNAPSHOTS:    { color: '#8b5cf6', icon: 'camera' },
  REWRITE_MANIFESTS:   { color: '#f59e0b', icon: 'files' },
  REWRITE_DATA_FILES:  { color: '#10b981', icon: 'database' },
  REMOVE_ORPHAN_FILES: { color: '#f43f5e', icon: 'brush' },
  ROLLBACK:            { color: '#3b82f6', icon: 'undo' },
};
const VIS_DEFAULT_META = { color: '#64748b', icon: 'zap' };

type TimelineTipMeta = {
  kind: 'snapshot' | 'execution';
  label: string;
  color: string;
  time: string;
  detail?: string;
  status?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'FAILED') return 'ice-tip-badge ice-tip-badge--failed';
  if (s === 'SUCCESS' || s === 'COMPLETED') return 'ice-tip-badge ice-tip-badge--success';
  if (s === 'RUNNING') return 'ice-tip-badge ice-tip-badge--running';
  return 'ice-tip-badge';
}

function renderTimelineTooltip(item: { tip?: TimelineTipMeta }): string {
  const tip = item.tip;
  if (!tip) return '';

  const statusHtml = tip.status
    ? `<span class="${statusBadgeClass(tip.status)}">${escapeHtml(tip.status)}</span>`
    : '';
  const kindLabel = tip.kind === 'snapshot' ? 'Snapshot' : 'Maintenance';
  const detailHtml = tip.detail
    ? `<p class="ice-tip-detail">${escapeHtml(tip.detail)}</p>`
    : '';

  return `
    <div class="ice-tip">
      <div class="ice-tip-header">
        <span class="ice-tip-dot" style="background-color:${tip.color}"></span>
        <div class="ice-tip-titles">
          <span class="ice-tip-label">${escapeHtml(tip.label)}</span>
          <span class="ice-tip-kind">${kindLabel}</span>
        </div>
        ${statusHtml}
      </div>
      <p class="ice-tip-time">${escapeHtml(tip.time)}</p>
      ${detailHtml}
    </div>
  `;
}

function TimelineTab({ catalogId, namespace, table, snapshots }: {
  catalogId: number; namespace: string; table: string; snapshots: SnapshotInfo[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<InstanceType<typeof import('vis-timeline').Timeline> | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ title: string; actionType?: string; status?: string; startedAt?: string | null; finishedAt?: string | null; result?: Record<string, unknown>; errorMessage?: string | null } | null>(null);

  const { data: executions } = useQuery({
    queryKey: ['executions-timeline', catalogId, namespace, table],
    queryFn: () => executionApi.list(100),
    select: (execs: ExecutionInfo[]) => execs.filter(
      (e) => e.namespace === namespace && e.tableName === table,
    ),
  });

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const presentTypes = React.useMemo(() => {
    const types = new Set<string>();
    for (const s of snapshots) types.add(s.operation);
    if (executions) for (const e of executions) types.add(e.actionType);
    return types;
  }, [snapshots, executions]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      // The standalone bundle re-exports DataSet at runtime, but its published
      // `types` entry resolves to declarations/index (which only imports it), so
      // we widen the module type with vis-data's exports to surface DataSet.
      const { Timeline, DataSet } = (await import('vis-timeline/standalone')) as
        typeof import('vis-timeline/standalone') & typeof import('vis-data');
      if (cancelled || !containerRef.current) return;

      const items = new DataSet<{
        id: string;
        content: string;
        start: Date;
        group: string;
        style: string;
        tip: TimelineTipMeta;
      }>();

      for (const snap of snapshots) {
        if (hiddenTypes.has(snap.operation)) continue;
        const m = VIS_META[snap.operation] ?? VIS_DEFAULT_META;
        const detail = [
          snap.summary['added-data-files'] && `+${snap.summary['added-data-files']} files`,
          snap.summary['added-records'] && `+${snap.summary['added-records']} records`,
        ].filter(Boolean).join(' · ') || undefined;
        items.add({
          id: `snap-${snap.snapshotId}`,
          content: `<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px">${svgIcon(m.icon)}</span>`,
          start: new Date(snap.timestamp),
          group: 'snapshot',
          style: `background-color: ${m.color}; border: 1px solid ${m.color}; color: #ffffff; border-radius: 50%; padding: 5px; font-size: 11px;`,
          tip: {
            kind: 'snapshot',
            label: `${snap.operation} · #${snap.snapshotId}`,
            color: m.color,
            time: new Date(snap.timestamp).toLocaleString(),
            detail,
          },
        });
      }

      if (executions) {
        for (const exec of executions) {
          if (hiddenTypes.has(exec.actionType)) continue;
          const failed = exec.status === 'FAILED';
          const m = failed ? VIS_FAILED_META : (VIS_META[exec.actionType] ?? VIS_DEFAULT_META);
          const label = exec.actionType.replace(/_/g, ' ').toLowerCase();
          items.add({
            id: `exec-${exec.id}`,
            content: `<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px">${svgIcon(m.icon)}</span>`,
            start: new Date(exec.startedAt),
            group: 'execution',
            style: `background-color: ${m.color}; border: 1px solid ${m.color}; color: #ffffff; border-radius: 50%; padding: 5px; font-size: 11px;`,
            tip: {
              kind: 'execution',
              label,
              color: m.color,
              time: new Date(exec.startedAt).toLocaleString(),
              status: exec.status,
              detail: exec.errorMessage ?? undefined,
            },
          });
        }
      }

      if (timelineRef.current) {
        timelineRef.current.destroy();
      }

      const tl = new Timeline(containerRef.current, items, {
        height: '420px',
        stack: true,
        showCurrentTime: true,
        zoomMin: 1000 * 60,
        zoomMax: 1000 * 60 * 60 * 24 * 365,
        orientation: { axis: 'bottom' },
        margin: { item: { horizontal: 4, vertical: 6 } },
        tooltip: {
          followMouse: true,
          overflowMethod: 'flip',
          delay: 120,
          template: (item) => renderTimelineTooltip(item as { tip?: TimelineTipMeta }),
        },
        xss: { disabled: true },
      });

      tl.on('select', (props: { items: Array<string | number> }) => {
        const id = props.items?.[0];
        if (id == null) return;
        const key = String(id);
        if (key.startsWith('exec-')) {
          const execId = Number(key.slice(5));
          const exec = executions?.find((e) => e.id === execId);
          if (exec) {
            setDetail({
              title: exec.actionType.replace(/_/g, ' ').toLowerCase(),
              actionType: exec.actionType,
              status: exec.status,
              startedAt: exec.startedAt,
              finishedAt: exec.finishedAt,
              result: exec.result,
              errorMessage: exec.errorMessage,
            });
          }
        } else if (key.startsWith('snap-')) {
          const snap = snapshots.find((s) => `snap-${s.snapshotId}` === key);
          if (snap) {
            setDetail({
              title: `${snap.operation} — snapshot ${snap.snapshotId}`,
              actionType: snap.operation,
              startedAt: snap.timestamp,
              finishedAt: snap.timestamp,
              result: snap.summary,
            });
          }
        }
      });

      timelineRef.current = tl;
    })();

    return () => {
      cancelled = true;
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [snapshots, executions, hiddenTypes]);

  const totalItems = snapshots.length + (executions?.length ?? 0);

  return (
    <div>
      {totalItems === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="mx-auto h-8 w-8 mb-2" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            {/* Timeline */}
            <div className="flex-1 min-w-0">
              <style>{`
            .vis-timeline {
              border: none !important;
              font-family: 'Geist Variable', sans-serif;
              box-shadow: none !important;
            }
            .vis-panel.vis-background,
            .vis-panel.vis-center {
              background-color: transparent !important;
            }
            .vis-panel.vis-top,
            .vis-panel.vis-left,
            .vis-labelset {
              display: none !important;
            }
            .vis-time-axis .vis-text {
              color: #94a3b8 !important;
              font-size: 10px !important;
            }
            .vis-time-axis .vis-grid.vis-minor {
              border-color: rgba(255,255,255,0.04) !important;
            }
            .vis-time-axis .vis-grid.vis-major {
              border-color: rgba(255,255,255,0.08) !important;
            }
            .vis-foreground .vis-group {
              border-bottom: none !important;
            }
            .vis-current-time {
              background-color: #6366f1 !important;
              width: 2px !important;
            }
            .vis-panel.vis-bottom {
              border-top: 1px solid rgba(255,255,255,0.06) !important;
            }
            .vis-shadow {
              display: none !important;
            }
            .vis-item .vis-item-overflow {
              overflow: visible !important;
            }
            .ice-vis-timeline .vis-tooltip {
              padding: 0 !important;
              white-space: normal !important;
              max-width: 300px;
              min-width: 200px;
              font-family: 'Geist Variable', sans-serif !important;
              font-size: 12px !important;
              line-height: 1.4 !important;
              color: var(--popover-foreground) !important;
              background: var(--popover) !important;
              border: 1px solid var(--border) !important;
              border-radius: 0.625rem !important;
              box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.04) !important;
              pointer-events: none;
              z-index: 50 !important;
              backdrop-filter: blur(8px);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip {
              padding: 10px 12px;
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-header {
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              margin-top: 5px;
              flex-shrink: 0;
              box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-titles {
              flex: 1;
              min-width: 0;
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-label {
              display: block;
              font-weight: 600;
              font-size: 13px;
              color: var(--foreground);
              text-transform: capitalize;
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-kind {
              display: block;
              font-size: 10px;
              color: var(--muted-foreground);
              margin-top: 1px;
              letter-spacing: 0.02em;
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-badge {
              flex-shrink: 0;
              font-size: 10px;
              font-weight: 600;
              padding: 2px 6px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              background: var(--muted);
              color: var(--muted-foreground);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-badge--success {
              background: color-mix(in srgb, var(--success) 18%, transparent);
              color: var(--success);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-badge--failed {
              background: color-mix(in srgb, var(--destructive) 18%, transparent);
              color: var(--destructive);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-badge--running {
              background: color-mix(in srgb, var(--warning) 18%, transparent);
              color: var(--warning);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-time {
              margin: 6px 0 0 16px;
              font-size: 11px;
              color: var(--muted-foreground);
            }
            .ice-vis-timeline .vis-tooltip .ice-tip-detail {
              margin: 6px 0 0 16px;
              font-size: 11px;
              color: var(--muted-foreground);
              border-left: 2px solid var(--border);
              padding-left: 8px;
              word-break: break-word;
            }
          `}</style>
              <div ref={containerRef} className="ice-vis-timeline rounded-lg overflow-hidden mt-2" />
              <p className="text-xs text-muted-foreground mt-2 opacity-50">Click an item to see its output · Scroll to zoom · Drag to pan</p>
            </div>
            {/* Filters — right side */}
            <div className="flex flex-col gap-1.5 shrink-0 w-44 pt-1">
              <span className="text-xs text-muted-foreground font-medium mb-1">Filter</span>
              {Array.from(presentTypes).map((type) => {
                const m = VIS_META[type] ?? VIS_DEFAULT_META;
                const hidden = hiddenTypes.has(type);
                const label = type.replace(/_/g, ' ').toLowerCase();
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer text-left"
                    style={{
                      backgroundColor: hidden ? 'transparent' : '#ffffff',
                      border: `1px solid ${hidden ? 'rgba(255,255,255,0.1)' : m.color}`,
                      color: hidden ? '#94a3b8' : '#111827',
                      opacity: hidden ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 20, height: 20, backgroundColor: m.color }}
                      dangerouslySetInnerHTML={{ __html: svgIcon(m.icon) }}
                    />
                    <span className="capitalize truncate">{label}</span>
                  </button>
                );
              })}
              {hiddenTypes.size > 0 && (
                <button
                  onClick={() => setHiddenTypes(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1"
                >
                  Show all
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <OperationOutputDialog
        open={detail !== null}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        title={detail?.title ?? ''}
        actionType={detail?.actionType}
        status={detail?.status}
        startedAt={detail?.startedAt}
        finishedAt={detail?.finishedAt}
        result={detail?.result}
        errorMessage={detail?.errorMessage}
      />
    </div>
  );
}

/* ═══════════════════════ Lineage Tab ═══════════════════════ */

function LineageTab({ catalogId, namespace, table, snapshots }: {
  catalogId: number; namespace: string; table: string; snapshots: SnapshotInfo[];
}) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['schema-history', catalogId, namespace, table],
    queryFn: () => tableApi.getSchemaHistory(catalogId, namespace, table),
  });

  const sorted = [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const effFrom = fromId || (sorted[1] ? String(sorted[1].snapshotId) : '');
  const effTo = toId || (sorted[0] ? String(sorted[0].snapshotId) : '');

  const { data: diff, isFetching: diffLoading } = useQuery({
    queryKey: ['snap-diff', catalogId, namespace, table, effFrom, effTo],
    queryFn: () => tableApi.compareSnapshots(catalogId, namespace, table, effFrom, effTo),
    enabled: !!effFrom && !!effTo && effFrom !== effTo,
  });

  return (
    <div className="space-y-4">
      <SchemaEvolutionCard history={history} isLoading={isLoading} />

      {/* Snapshot comparison */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><GitCompare className="h-4 w-4 text-cyan-500" /> Compare Snapshots</CardTitle></CardHeader>
        <CardContent>
          {sorted.length < 2 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Need at least two snapshots to compare.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <SnapshotSelect snapshots={sorted} value={effFrom} onChange={setFromId} label="From" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <SnapshotSelect snapshots={sorted} value={effTo} onChange={setToId} label="To" />
              </div>
              {effFrom === effTo ? (
                <p className="text-center text-muted-foreground py-6 text-sm">Pick two different snapshots.</p>
              ) : diffLoading ? (
                <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-12" /></div>
              ) : diff ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {diff.metrics.map((m) => <MetricDeltaCard key={m.key} metric={m} />)}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2"><Columns3 className="h-4 w-4 text-blue-500" /> Schema changes</p>
                    {diff.schemaDiff ? <SchemaDiffGraphic diff={diff.schemaDiff} /> : <p className="text-sm text-muted-foreground">Same schema (v{diff.from.schemaId ?? '?'}) — no column changes.</p>}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SnapshotSelect({ snapshots, value, onChange, label }: {
  snapshots: SnapshotInfo[]; value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[260px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {snapshots.map((s) => (
            <SelectItem key={s.snapshotId} value={String(s.snapshotId)}>
              <span className="font-mono">{String(s.snapshotId).slice(0, 8)}…</span>
              <span className="text-muted-foreground"> · {s.operation} · {new Date(s.timestamp).toLocaleString()}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MetricDeltaCard({ metric }: { metric: import('@/types').MetricDelta }) {
  const isSize = metric.key === 'total-files-size';
  const fmt = (n: number) => (isSize ? formatBytes(n) : n.toLocaleString());
  const up = metric.delta > 0, down = metric.delta < 0;
  const color = up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-muted-foreground';
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  const deltaStr = `${metric.delta > 0 ? '+' : ''}${fmt(metric.delta)}`;
  return (
    <Card className="shadow-card">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{metric.label}</p>
        <p className="text-sm font-mono mt-1">{fmt(metric.from)} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {fmt(metric.to)}</p>
        <p className={`text-sm font-semibold flex items-center gap-1 mt-1 ${color}`}><Icon className="h-3.5 w-3.5" />{deltaStr}</p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════ Storage Tab ═══════════════════════ */

type PartitionStorage = import('@/types').PartitionStorage;

const SORT_OPTIONS = [
  { key: 'size', label: 'Size' },
  { key: 'files', label: 'Files' },
  { key: 'records', label: 'Records' },
  { key: 'name', label: 'Name' },
] as const;
type SortKey = typeof SORT_OPTIONS[number]['key'];

const PARTITION_PAGE_SIZE = 25;

function StorageTab({ catalogId, namespace, table }: { catalogId: number; namespace: string; table: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['storage', catalogId, namespace, table],
    queryFn: () => tableApi.getStorage(catalogId, namespace, table),
  });
  const [selected, setSelected] = useState<PartitionStorage | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // Debounce the search box and reset to the first page on change.
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: partPage, isFetching: partFetching } = useQuery({
    queryKey: ['storage-partitions', catalogId, namespace, table, page, sortKey, sortDir, debouncedQuery],
    queryFn: () => tableApi.getStoragePartitions(catalogId, namespace, table, {
      offset: page * PARTITION_PAGE_SIZE, limit: PARTITION_PAGE_SIZE, sort: sortKey, dir: sortDir, search: debouncedQuery,
    }),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-64" /></div>;
  }
  if (isError || !data) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground"><HardDrive className="mx-auto h-8 w-8 mb-2 opacity-50" /><p>Could not read storage state.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-4 w-4" /> Retry</Button></CardContent></Card>;
  }

  const totalFiles = data.totalDataFiles + data.totalDeleteFiles;
  const smallFiles = data.fileSizeHistogram.slice(0, 2).reduce((s, b) => s + b.count, 0); // < 8 MB
  const smallRatio = data.totalDataFiles > 0 ? Math.round((smallFiles / data.totalDataFiles) * 100) : 0;
  const avgVsTarget = data.targetFileSizeBytes > 0 ? Math.round((data.avgFileSizeBytes / data.targetFileSizeBytes) * 100) : 0;
  const deleteRatio = totalFiles > 0 ? Math.round((data.totalDeleteFiles / totalFiles) * 100) : 0;
  const needsCompaction = data.totalDataFiles > 1 && data.avgFileSizeBytes < data.targetFileSizeBytes / 2;

  const histogram = data.fileSizeHistogram.map((b) => ({ label: b.label, count: b.count, totalBytes: b.totalBytes }));
  const maxPartitionSize = Math.max(1, data.maxPartitionSizeBytes);

  const partitions = partPage?.partitions ?? [];
  const total = partPage?.total ?? 0;
  const from = total === 0 ? 0 : page * PARTITION_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PARTITION_PAGE_SIZE);
  const changeSort = (k: SortKey) => { setSortKey(k); setPage(0); };
  const toggleDir = () => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(0); };

  if (selected) {
    return <PartitionFilesPanel catalogId={catalogId} namespace={namespace} table={table} partition={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Live state at snapshot <span className="font-mono text-foreground">{!data.currentSnapshotId || data.currentSnapshotId === '-1' ? '—' : data.currentSnapshotId}</span>
          {data.partitioned ? <> · partitioned by <span className="text-cyan-400">{data.partitionFields.join(', ')}</span></> : ' · unpartitioned'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Refresh</Button>
      </div>

      {/* Stat table */}
      <StatTable items={[
        { label: 'Total Size', value: formatBytes(data.totalSizeBytes), color: 'text-cyan-400' },
        { label: 'Data Files', value: data.totalDataFiles.toLocaleString() },
        { label: 'Records', value: data.totalRecords.toLocaleString(), color: 'text-emerald-400' },
        { label: 'Delete Files', value: data.totalDeleteFiles.toLocaleString(), color: data.totalDeleteFiles > 0 ? 'text-rose-400' : 'text-foreground' },
        { label: 'Partitions', value: data.partitionCount.toLocaleString(), color: 'text-violet-400' },
        { label: 'Avg File', value: formatBytes(data.avgFileSizeBytes), color: 'text-amber-400' },
      ]} />

      {/* Insights + histogram */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-500" /> File size distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={histogram} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(v, _n, p) => [`${v} files · ${formatBytes((p.payload as { totalBytes: number }).totalBytes)}`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogram.map((_, i) => <Cell key={i} fill={i < 2 ? '#f43f5e' : i < 4 ? '#f59e0b' : '#06b6d4'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4 text-amber-500" /> Health</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InsightRow label="Avg vs target file size" value={`${avgVsTarget}%`} hint={`target ${formatBytes(data.targetFileSizeBytes)}`} tone={avgVsTarget < 50 ? 'bad' : avgVsTarget < 90 ? 'warn' : 'good'} />
            <InsightRow label="Small files (< 8 MB)" value={`${smallFiles} (${smallRatio}%)`} tone={smallRatio > 50 ? 'bad' : smallRatio > 20 ? 'warn' : 'good'} />
            <InsightRow label="Delete file ratio" value={`${deleteRatio}%`} hint={`${data.positionDeleteFiles} pos · ${data.equalityDeleteFiles} eq`} tone={deleteRatio > 30 ? 'bad' : deleteRatio > 10 ? 'warn' : 'good'} />
            <InsightRow label="File size range" value={`${formatBytes(data.minFileSizeBytes)} – ${formatBytes(data.maxFileSizeBytes)}`} tone="neutral" />
            {needsCompaction && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-amber-300 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Many small files — running <strong>Rewrite Data Files</strong> (Spark) would improve query performance.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partition navigator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-violet-500" /> {data.partitioned ? 'Partitions' : 'Storage'} <Badge className="bg-violet-500/10 text-violet-400 border-0">{data.partitionCount}</Badge>{partFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter partitions…" className="h-8 w-48 pl-7 text-xs" disabled={!data.partitioned} />
              </div>
              <Select value={sortKey} onValueChange={(v) => changeSort(v as SortKey)}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>Sort: {o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={toggleDir} title="Toggle direction">{sortDir === 'asc' ? '↑' : '↓'}</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partitions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">{debouncedQuery ? 'No partitions match.' : 'No partitions.'}</p>
          ) : (
            <UiTable>
              <TableHeader><TableRow>
                <TableHead>Partition</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Delete</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {partitions.map((p) => (
                  <TableRow key={p.path || '__root__'} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(p)}>
                    <TableCell>
                      {p.values.length > 0 ? (
                        <span className="flex flex-wrap gap-1">{p.values.map((v) => <Badge key={v.field} variant="secondary" className="font-mono text-[11px]"><span className="text-muted-foreground">{v.field}=</span>{v.value}</Badge>)}</span>
                      ) : <span className="text-muted-foreground italic">(unpartitioned)</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{p.dataFileCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{p.deleteFileCount > 0 ? <span className="text-rose-400">{p.deleteFileCount}</span> : <span className="text-muted-foreground">0</span>}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.recordCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatBytes(p.avgFileSizeBytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${Math.max(3, (p.totalSizeBytes / maxPartitionSize) * 100)}%` }} /></div>
                        <span className="text-xs tabular-nums w-16">{formatBytes(p.totalSizeBytes)}</span>
                      </div>
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </UiTable>
          )}

          {total > PARTITION_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
              <span>{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7" disabled={page === 0 || partFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" className="h-7" disabled={to >= total || partFetching} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightRow({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const color = tone === 'bad' ? 'text-rose-400' : tone === 'warn' ? 'text-amber-400' : tone === 'good' ? 'text-emerald-400' : 'text-foreground';
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}{hint && <span className="ml-1 text-xs opacity-60">· {hint}</span>}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function PartitionFilesPanel({ catalogId, namespace, table, partition, onBack }: {
  catalogId: number; namespace: string; table: string; partition: PartitionStorage; onBack: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['storage-files', catalogId, namespace, table, partition.path],
    queryFn: () => tableApi.getStorageFiles(catalogId, namespace, table, partition.path),
  });
  const name = partition.path || '(unpartitioned)';
  const baseName = (path: string) => path.split('/').pop() ?? path;
  const contentBadge = (c: string) =>
    c === 'DATA'
      ? <Badge className="bg-cyan-500/10 text-cyan-400 border-0">data</Badge>
      : <Badge className="bg-rose-500/10 text-rose-400 border-0">{c === 'POSITION_DELETES' ? 'pos-delete' : 'eq-delete'}</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
        <span className="flex flex-wrap items-center gap-1.5">
          <Layers className="h-4 w-4 text-violet-500" />
          {partition.values.length > 0 ? partition.values.map((v) => <Badge key={v.field} variant="secondary" className="font-mono text-[11px]"><span className="text-muted-foreground">{v.field}=</span>{v.value}</Badge>) : <span className="font-medium">{name}</span>}
        </span>
      </div>

      <StatTable items={[
        { label: 'Size', value: formatBytes(partition.totalSizeBytes), color: 'text-cyan-400' },
        { label: 'Data Files', value: partition.dataFileCount.toLocaleString() },
        { label: 'Records', value: partition.recordCount.toLocaleString(), color: 'text-emerald-400' },
        { label: 'Delete Files', value: partition.deleteFileCount.toLocaleString(), color: partition.deleteFileCount > 0 ? 'text-rose-400' : 'text-foreground' },
        { label: 'Avg / Min', value: `${formatBytes(partition.avgFileSizeBytes)} / ${formatBytes(partition.minFileSizeBytes)}`, color: 'text-amber-400' },
        { label: 'Max File', value: formatBytes(partition.maxFileSizeBytes) },
      ]} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-500" /> Files {data && <Badge className="bg-cyan-500/10 text-cyan-400 border-0">{data.returned}{data.truncated ? '+' : ''}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : !data || data.files.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No files.</p>
          ) : (
            <>
              {data.truncated && <p className="text-xs text-amber-400 mb-2">Showing first {data.returned} files.</p>}
              <ScrollArea className="max-h-[420px]">
                <UiTable>
                  <TableHeader><TableRow><TableHead>File</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Records</TableHead><TableHead className="text-right">Size</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.files.map((f) => (
                      <TableRow key={f.path}>
                        <TableCell className="font-mono text-xs text-muted-foreground" title={f.path}>{baseName(f.path)}</TableCell>
                        <TableCell>{contentBadge(f.content)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{f.recordCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBytes(f.sizeBytes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </UiTable>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════ Helpers ═══════════════════════ */

function StatTable({ items }: { items: { label: string; value: string | number; color?: string }[] }) {
  return (
    <Card className="overflow-x-auto">
      <UiTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {items.map((it) => (
              <TableHead key={it.label} className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">{it.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent border-0">
            {items.map((it) => (
              <TableCell key={it.label} className={`text-lg font-bold tabular-nums whitespace-nowrap ${it.color ?? 'text-foreground'}`}>{it.value}</TableCell>
            ))}
          </TableRow>
        </TableBody>
      </UiTable>
    </Card>
  );
}

function StatMiniCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  return (
    <Card className="glass shadow-card">
      <CardContent className="pt-4 flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatExecDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatExecTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
