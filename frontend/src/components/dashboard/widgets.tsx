import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tableApi, executionApi, dashboardWidgetApi, catalogApi, pipelineApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Pin, Loader2, Activity, HardDrive, BarChart3, Layers, Plus, Database, GitBranch, AlertTriangle, Clock3 } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ── shared ── */
export interface WidgetProps {
  catalogId?: number | null;
  namespace?: string | null;
  tableName?: string | null;
  params: Record<string, string>;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

const Metric = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={cn('text-xl font-bold tabular-nums', color ?? 'text-foreground')}>{value}</p>
  </div>
);

const needsTable = (p: WidgetProps) => !p.catalogId || !p.namespace || !p.tableName;
const MissingTable = () => <p className="py-4 text-center text-xs text-muted-foreground">This widget needs a table.</p>;

/* ── Storage overview ── */
function StorageOverviewWidget(p: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['w-storage', p.catalogId, p.namespace, p.tableName],
    queryFn: () => tableApi.getStorage(p.catalogId!, p.namespace!, p.tableName!),
    enabled: !needsTable(p),
  });
  if (needsTable(p)) return <MissingTable />;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError || !data) return <p className="py-4 text-center text-xs text-rose-400">Could not read storage.</p>;
  return (
    <div className="grid grid-cols-3 gap-3">
      <Metric label="Total size" value={formatBytes(data.totalSizeBytes)} color="text-cyan-400" />
      <Metric label="Data files" value={data.totalDataFiles.toLocaleString()} />
      <Metric label="Records" value={data.totalRecords.toLocaleString()} color="text-emerald-400" />
      <Metric label="Delete files" value={data.totalDeleteFiles.toLocaleString()} color={data.totalDeleteFiles > 0 ? 'text-rose-400' : undefined} />
      <Metric label="Partitions" value={data.partitionCount.toLocaleString()} color="text-violet-400" />
      <Metric label="Avg file" value={formatBytes(data.avgFileSizeBytes)} color="text-amber-400" />
    </div>
  );
}

/* ── Maintenance reliability ── */
function MaintenanceReliabilityWidget(p: WidgetProps) {
  const succ = useQuery({
    queryKey: ['w-rel', p.catalogId, p.namespace, p.tableName, 'SUCCESS'],
    queryFn: () => executionApi.search({ catalogId: p.catalogId!, namespace: p.namespace!, table: p.tableName!, status: 'SUCCESS', size: 1, page: 0 }),
    enabled: !needsTable(p),
  });
  const fail = useQuery({
    queryKey: ['w-rel', p.catalogId, p.namespace, p.tableName, 'FAILED'],
    queryFn: () => executionApi.search({ catalogId: p.catalogId!, namespace: p.namespace!, table: p.tableName!, status: 'FAILED', size: 1, page: 0 }),
    enabled: !needsTable(p),
  });
  if (needsTable(p)) return <MissingTable />;
  if (succ.isLoading || fail.isLoading) return <Skeleton className="h-20 w-full" />;
  const commits = succ.data?.total ?? 0;
  const failed = fail.data?.total ?? 0;
  const total = commits + failed;
  const rate = total > 0 ? Math.round((failed / total) * 100) : 0;
  const tone = rate >= 30 ? 'text-rose-400' : rate >= 10 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Failure rate" value={`${rate}%`} color={tone} />
        <Metric label="Commits" value={commits.toLocaleString()} color="text-emerald-400" />
        <Metric label="Failed" value={failed.toLocaleString()} color="text-rose-400" />
      </div>
      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-rose-500" style={{ width: `${rate}%` }} /></div>
      )}
    </div>
  );
}

/* ── Hot partitions ── */
function HotPartitionsWidget(p: WidgetProps) {
  const hours = Number(p.params.windowHours) || 6;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['w-hot', p.catalogId, p.namespace, p.tableName, hours],
    queryFn: () => tableApi.getHotPartitions(p.catalogId!, p.namespace!, p.tableName!, hours),
    enabled: !needsTable(p),
  });
  if (needsTable(p)) return <MissingTable />;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) return <p className="py-4 text-center text-xs text-rose-400">Could not read snapshot history.</p>;
  const max = Math.max(1, ...(data ?? []).map((h) => h.commits));
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">Last {hours}h · {(data ?? []).length} partition(s)</p>
      {(data ?? []).length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No partitions touched.</p>
      ) : (data ?? []).slice(0, 8).map((h) => (
        <div key={h.partition || '__root__'} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-mono">{h.partition || '(unpartitioned)'}</span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full bg-rose-500" style={{ width: `${(h.commits / max) * 100}%` }} /></div>
          <span className="w-6 text-right tabular-nums">{h.commits}</span>
        </div>
      ))}
    </div>
  );
}

/* ── File size distribution ── */
function FileHistogramWidget(p: WidgetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['w-hist', p.catalogId, p.namespace, p.tableName],
    queryFn: () => tableApi.getStorage(p.catalogId!, p.namespace!, p.tableName!),
    enabled: !needsTable(p),
  });
  if (needsTable(p)) return <MissingTable />;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError || !data) return <p className="py-4 text-center text-xs text-rose-400">Could not read storage.</p>;
  const hist = data.fileSizeHistogram.map((b) => ({ label: b.label, count: b.count }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={hist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {hist.map((_, i) => <Cell key={i} fill={i < 2 ? '#f43f5e' : i < 4 ? '#f59e0b' : '#06b6d4'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Global widgets (no table needed) ── */
const PIE = { emerald: '#10b981', rose: '#f43f5e', blue: '#3b82f6', gray: '#475569' };

function CatalogsCountWidget() {
  const catalogs = useQuery({ queryKey: ['catalogs'], queryFn: catalogApi.list });
  const pipelines = useQuery({ queryKey: ['pipelines'], queryFn: pipelineApi.list });
  if (catalogs.isLoading) return <Skeleton className="h-10 w-full" />;
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums">{catalogs.data?.length ?? 0}</p>
      {(pipelines.data?.length ?? 0) > 0 && (
        <p className="mt-1 text-xs text-muted-foreground"><GitBranch className="inline h-3 w-3" /> {pipelines.data!.length} pipeline(s)</p>
      )}
    </div>
  );
}

function ExecutionsSummaryWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['executions'], queryFn: () => executionApi.list(20) });
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const s = data?.filter((e) => e.status === 'SUCCESS').length ?? 0;
  const f = data?.filter((e) => e.status === 'FAILED').length ?? 0;
  const r = data?.filter((e) => e.status === 'RUNNING').length ?? 0;
  const total = data?.length ?? 0;
  const pie = [
    { name: 'Success', value: s, color: PIE.emerald },
    { name: 'Failed', value: f, color: PIE.rose },
    { name: 'Running', value: r, color: PIE.blue },
    { name: 'Other', value: Math.max(0, total - s - f - r), color: PIE.gray },
  ].filter((d) => d.value > 0);
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-3xl font-bold tabular-nums">{total}</p>
        <p className="text-xs text-muted-foreground">{s} ok · {f} failed · {r} running</p>
      </div>
      {total > 0 && (
        <ResponsiveContainer width={56} height={56}>
          <PieChart><Pie data={pie} cx="50%" cy="50%" innerRadius={16} outerRadius={26} dataKey="value" strokeWidth={0}>{pie.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function FailedExecutionsWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['executions'], queryFn: () => executionApi.list(20) });
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  const f = data?.filter((e) => e.status === 'FAILED').length ?? 0;
  return <p className={cn('text-3xl font-bold tabular-nums', f > 0 ? 'text-rose-400' : 'text-emerald-400')}>{f}</p>;
}

function RecentExecutionsWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['executions'], queryFn: () => executionApi.list(20) });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const recent = (data ?? []).slice(0, 6);
  if (recent.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">No executions yet.</p>;
  return (
    <div className="space-y-1.5">
      {recent.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">{e.actionType.replace(/_/g, ' ').toLowerCase()}</span>{' '}
            <span className="font-mono">{e.namespace}.{e.tableName}</span>
          </span>
          <StatusBadge status={e.status} />
        </div>
      ))}
    </div>
  );
}

function CatalogListWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['catalogs'], queryFn: catalogApi.list });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">No catalogs.</p>;
  return (
    <div className="space-y-1">
      {data.map((c) => (
        <Link key={c.id} to={`/catalogs/${c.id}`} className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-accent">
          <Database className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{c.vendor}</span>
        </Link>
      ))}
    </div>
  );
}

/* ── Registry ── */
type WidgetScope = 'table' | 'global';
interface WidgetEntry { label: string; icon: typeof HardDrive; scope: WidgetScope; wide?: boolean; Component: React.FC<WidgetProps>; }

export const WIDGET_REGISTRY: Record<string, WidgetEntry> = {
  'storage-overview': { label: 'Storage overview', icon: HardDrive, scope: 'table', Component: StorageOverviewWidget },
  'maintenance-reliability': { label: 'Maintenance reliability', icon: Activity, scope: 'table', Component: MaintenanceReliabilityWidget },
  'hot-partitions': { label: 'Recently active partitions', icon: Layers, scope: 'table', Component: HotPartitionsWidget },
  'file-histogram': { label: 'File size distribution', icon: BarChart3, scope: 'table', wide: true, Component: FileHistogramWidget },
  'catalogs-count': { label: 'Catalogs count', icon: Database, scope: 'global', Component: CatalogsCountWidget },
  'executions-summary': { label: 'Executions summary', icon: Activity, scope: 'global', Component: ExecutionsSummaryWidget },
  'failed-executions': { label: 'Failed executions', icon: AlertTriangle, scope: 'global', Component: FailedExecutionsWidget },
  'recent-executions': { label: 'Recent executions', icon: Clock3, scope: 'global', wide: true, Component: RecentExecutionsWidget },
  'catalog-list': { label: 'Catalog list', icon: Database, scope: 'global', wide: true, Component: CatalogListWidget },
};

export function renderWidget(widgetType: string, props: WidgetProps): React.ReactNode {
  const entry = WIDGET_REGISTRY[widgetType];
  if (!entry) return <p className="py-4 text-center text-xs text-muted-foreground">Unknown widget: {widgetType}</p>;
  const C = entry.Component;
  return <C {...props} />;
}

/* ── Reusable "Add to dashboard" button + title dialog ── */
export function PinToDashboardButton({ widgetType, defaultTitle, catalogId, namespace, tableName, params, size = 'icon', variant = 'ghost' }: {
  widgetType: string;
  defaultTitle: string;
  catalogId?: number | null;
  namespace?: string | null;
  tableName?: string | null;
  params?: Record<string, string>;
  size?: 'icon' | 'sm';
  variant?: 'ghost' | 'outline';
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const m = useMutation({
    mutationFn: () => dashboardWidgetApi.create({
      title: title.trim() || defaultTitle,
      widgetType,
      catalogId: catalogId ?? undefined,
      namespace: namespace ?? undefined,
      tableName: tableName ?? undefined,
      params,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      toast.success('Added to dashboard');
      setOpen(false);
    },
    onError: (e: Error) => toast.error(`Could not add: ${e.message}`),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setTitle(defaultTitle); }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={size === 'icon' ? 'h-7 w-7' : 'h-8'} title="Add to dashboard">
          <Pin className="h-3.5 w-3.5" />{size === 'sm' && <span className="ml-1">Pin</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to dashboard</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-title">Title</Label>
            <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">
              {WIDGET_REGISTRY[widgetType]?.label ?? widgetType}
              {tableName && <> · {namespace}.{tableName}</>}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add to dashboard
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Wrapper used on the dashboard: title + remove + live widget ── */
export function DashboardWidgetCard({ id, title, widgetType, catalogId, namespace, tableName, params, onRemove, dragHandle, editMode }: {
  id: number; title: string; widgetType: string;
  catalogId: number | null; namespace: string | null; tableName: string | null;
  params: Record<string, string>;
  onRemove: (id: number) => void;
  dragHandle?: React.ReactNode;
  editMode?: boolean;
}) {
  const entry = WIDGET_REGISTRY[widgetType];
  const Icon = entry?.icon ?? HardDrive;
  return (
    <Card className="glass shadow-card h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {editMode && dragHandle}
          <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
          <span className="truncate">{title}</span>
        </CardTitle>
        {editMode && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-rose-400" onClick={() => onRemove(id)} title="Remove from dashboard">
            <span className="text-base leading-none">×</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {renderWidget(widgetType, { catalogId, namespace, tableName, params })}
        {tableName && <p className="mt-2 truncate text-[11px] text-muted-foreground">{namespace}.{tableName}</p>}
      </CardContent>
    </Card>
  );
}

/* ── "Add widget" gallery (global widgets; table widgets are pinned from a table page) ── */
export function AddWidgetGallery() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const addM = useMutation({
    mutationFn: (widgetType: string) => dashboardWidgetApi.create({ title: WIDGET_REGISTRY[widgetType].label, widgetType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-widgets'] }); toast.success('Widget added'); },
    onError: (e: Error) => toast.error(`Could not add: ${e.message}`),
  });
  const globals = Object.entries(WIDGET_REGISTRY).filter(([, e]) => e.scope === 'global');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" /> Add widget</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a widget</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {globals.map(([type, e]) => {
            const Icon = e.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => addM.mutate(type)}
                disabled={addM.isPending}
                className="flex w-full items-center gap-2 rounded-md border border-border/60 p-2 text-left text-sm transition-colors hover:border-indigo-500/40 hover:bg-accent disabled:opacity-60"
              >
                <Icon className="h-4 w-4 text-indigo-400" />
                <span className="flex-1">{e.label}</span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
          <p className="pt-2 text-[11px] text-muted-foreground">
            Table widgets (storage, reliability, hot partitions, file sizes…) are added from a
            table's Storage or Overview tab with the pin button.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
