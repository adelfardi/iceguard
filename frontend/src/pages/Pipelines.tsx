import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, catalogApi, namespaceApi, sparkClusterApi } from '@/api/client';
import type { CreatePipelineRequest, PipelineResponse } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  Pencil,
  Loader2,
  Clock,
  Database,
  Search,
  X,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PipelineFlow, ACTION_TYPE_META, getActionMeta } from '@/components/pipeline/PipelineFlow';
import { StatusBadge } from '@/components/ui/status-badge';
import { RewriteOptionsEditor, cleanRewriteParams } from '@/components/maintenance/RewriteOptions';

const ACTION_TYPES = Object.keys(ACTION_TYPE_META);

const ENGINE_PARAM = 'engine';
const SPARK_CLUSTER_PARAM = 'sparkClusterId';
const RETRIES_PARAM = 'retries';
const RETRY_DELAY_PARAM = 'retryDelaySeconds';
/** Reserved task-parameter keys — consumed by the backend, not passed as Iceberg options. */
const RESERVED_PARAMS = [ENGINE_PARAM, SPARK_CLUSTER_PARAM, RETRIES_PARAM, RETRY_DELAY_PARAM];

function taskEngine(task: TaskDraft): 'java' | 'spark' {
  return task.parameters[ENGINE_PARAM] === 'spark' ? 'spark' : 'java';
}

function taskSparkCluster(task: TaskDraft): string {
  return task.parameters[SPARK_CLUSTER_PARAM] ?? 'local';
}

/** Per-action parameter fields, mirroring the Maintenance tab. `factor` converts the
 *  human-friendly input (hours, MB) to the raw value the executor expects (ms, bytes). */
interface ActionParamField {
  key: string;
  label: string;
  placeholder?: string;
  factor?: number;
}
const ACTION_PARAMS: Record<string, ActionParamField[]> = {
  EXPIRE_SNAPSHOTS: [
    { key: 'olderThanMs', label: 'Older than (hours)', placeholder: '168', factor: 3_600_000 },
    { key: 'retainLast', label: 'Retain last N', placeholder: '5' },
  ],
  REMOVE_ORPHAN_FILES: [
    { key: 'olderThanMs', label: 'Older than (hours)', placeholder: '72', factor: 3_600_000 },
  ],
  REWRITE_MANIFESTS: [],
};

function paramDisplayValue(parameters: Record<string, string>, field: ActionParamField): string {
  const raw = parameters[field.key];
  if (raw == null || raw === '') return '';
  if (field.factor) {
    const n = Number(raw) / field.factor;
    return Number.isFinite(n) ? String(n) : '';
  }
  return raw;
}

interface TaskDraft {
  key: string;
  name: string;
  actionType: string;
  parameters: Record<string, string>;
}

const WIZARD_STEPS = [
  { id: 'target', title: 'Target', description: 'Choose catalog, namespace and table' },
  { id: 'tasks', title: 'Tasks', description: 'Build the sequence' },
  { id: 'schedule', title: 'Cron', description: 'Schedule the run' },
  { id: 'details', title: 'Details', description: 'Name and describe it' },
] as const;

type TargetStage = 'catalog' | 'namespace' | 'table';

function createTaskDraft(): TaskDraft {
  const actionType = ACTION_TYPES[0];
  return {
    key: crypto.randomUUID(),
    name: getActionMeta(actionType).label,
    actionType,
    parameters: {},
  };
}

interface SearchCardOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

function SearchCardPicker({
  searchPlaceholder,
  options,
  value,
  onChange,
  disabled,
  loading,
  emptyLabel,
}: {
  searchPlaceholder: string;
  options: SearchCardOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      option.label.toLowerCase().includes(q) ||
      option.description?.toLowerCase().includes(q) ||
      option.badge?.toLowerCase().includes(q)
    );
  });

  return (
    <Card className={cn('glass shadow-card', disabled && 'opacity-60')}>
      <CardContent className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
            className="h-8 pl-8 text-sm"
          />
        </div>

        <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {loading ? (
            [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : filtered.length === 0 ? (
            <p className="col-span-full rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            filtered.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(option.value)}
                  className={cn(
                    'min-w-0 rounded-lg border p-3 text-left transition-all',
                    'hover:border-indigo-500/40 hover:bg-indigo-500/[0.04]',
                    selected
                      ? 'border-indigo-500/60 bg-indigo-500/[0.08] ring-1 ring-indigo-500/30'
                      : 'border-border/60 bg-card/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{option.label}</span>
                    {option.badge && (
                      <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                        {option.badge}
                      </Badge>
                    )}
                  </div>
                  {option.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{option.description}</p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatNextRun(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return '—';

  const now = new Date();
  const matchesField = (field: string, value: number): boolean => {
    if (field === '*') return true;
    for (const part of field.split(',')) {
      if (part.includes('/')) {
        const [base, stepStr] = part.split('/');
        const step = parseInt(stepStr);
        const start = base === '*' ? 0 : parseInt(base);
        for (let i = start; i <= 59; i += step) {
          if (i === value) return true;
        }
      } else if (part.includes('-')) {
        const [lo, hi] = part.split('-').map(Number);
        if (value >= lo && value <= hi) return true;
      } else {
        if (parseInt(part) === value) return true;
      }
    }
    return false;
  };

  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  for (let i = 0; i < 1440; i++) {
    const m = candidate.getUTCMinutes();
    const h = candidate.getUTCHours();
    const dom = candidate.getUTCDate();
    const mon = candidate.getUTCMonth() + 1;
    const dow = candidate.getUTCDay();

    if (matchesField(parts[0], m) && matchesField(parts[1], h) &&
        matchesField(parts[2], dom) && matchesField(parts[3], mon) &&
        matchesField(parts[4], dow)) {
      const diff = candidate.getTime() - now.getTime();
      const mins = Math.round(diff / 60000);
      if (mins < 1) return 'now';
      if (mins < 60) return `in ${mins}m`;
      if (mins < 1440) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
      return candidate.toLocaleString();
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return '—';
}

type CronMode = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
const CRON_MODES: { id: CronMode; label: string }[] = [
  { id: 'minutes', label: 'Every N min' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom' },
];
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Best-effort parse of a 5-field cron into the builder's mode + fields (for prefill). */
function parseCron(value: string): { mode: CronMode; everyN: string; minute: string; hour: string; dow: string; dom: string } {
  const def = { mode: 'custom' as CronMode, everyN: '15', minute: '0', hour: '2', dow: '1', dom: '1' };
  const p = value.trim().split(/\s+/);
  if (!value.trim() || p.length !== 5) return def;
  const [m, h, dom, mon, dow] = p;
  if (mon === '*') {
    if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && dow === '*') return { ...def, mode: 'minutes', everyN: m.slice(2) };
    if (/^\d+$/.test(m) && h === '*' && dom === '*' && dow === '*') return { ...def, mode: 'hourly', minute: m };
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === '*' && dow === '*') return { ...def, mode: 'daily', minute: m, hour: h };
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === '*' && /^\d+$/.test(dow)) return { ...def, mode: 'weekly', minute: m, hour: h, dow };
    if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom) && dow === '*') return { ...def, mode: 'monthly', minute: m, hour: h, dom };
  }
  return def;
}

/** Graphical cron composer — presets + typed fields generate a 5-field cron. */
function CronBuilder({ value, onChange }: { value: string; onChange: (cron: string) => void }) {
  const init = React.useMemo(() => parseCron(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<CronMode>(init.mode);
  const [everyN, setEveryN] = useState(init.everyN);
  const [minute, setMinute] = useState(init.minute);
  const [hour, setHour] = useState(init.hour);
  const [dow, setDow] = useState(init.dow);
  const [dom, setDom] = useState(init.dom);

  const clamp = (v: string, lo: number, hi: number) => String(Math.min(hi, Math.max(lo, Math.floor(Number(v) || 0))));

  // Regenerate the cron whenever a builder field changes (custom mode is user-typed).
  React.useEffect(() => {
    if (mode === 'custom') return;
    const mm = clamp(minute, 0, 59);
    const hh = clamp(hour, 0, 23);
    let cron = '';
    switch (mode) {
      case 'minutes': cron = `*/${clamp(everyN, 1, 59)} * * * *`; break;
      case 'hourly': cron = `${mm} * * * *`; break;
      case 'daily': cron = `${mm} ${hh} * * *`; break;
      case 'weekly': cron = `${mm} ${hh} * * ${dow}`; break;
      case 'monthly': cron = `${mm} ${hh} ${clamp(dom, 1, 31)} * *`; break;
    }
    if (cron) onChange(cron);
  }, [mode, everyN, minute, hour, dow, dom]); // eslint-disable-line react-hooks/exhaustive-deps

  const numField = (label: string, val: string, set: (v: string) => void, min: number, max: number) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={min} max={max} value={val} onChange={(e) => set(e.target.value)} className="h-9" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CRON_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs transition-colors',
              mode === m.id ? 'border-indigo-500/60 bg-indigo-500/[0.1] text-indigo-300' : 'border-border/60 text-muted-foreground hover:border-indigo-500/40',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== 'custom' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {mode === 'minutes' && numField('Every (minutes)', everyN, setEveryN, 1, 59)}
          {mode === 'hourly' && numField('At minute', minute, setMinute, 0, 59)}
          {(mode === 'daily' || mode === 'weekly' || mode === 'monthly') && (
            <>
              {numField('Hour (0-23)', hour, setHour, 0, 23)}
              {numField('Minute (0-59)', minute, setMinute, 0, 59)}
            </>
          )}
          {mode === 'weekly' && (
            <div className="space-y-1">
              <Label className="text-xs">Day of week</Label>
              <Select value={dow} onValueChange={setDow}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{DOW_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {mode === 'monthly' && numField('Day of month', dom, setDom, 1, 31)}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="pipeline-cron" className="text-xs">Cron expression {mode !== 'custom' && <span className="text-muted-foreground">(generated)</span>}</Label>
        <Input
          id="pipeline-cron"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={mode !== 'custom'}
          placeholder="0 2 * * * (optional)"
          className={cn('font-mono', mode !== 'custom' && 'opacity-80')}
        />
        <p className="text-[11px] text-muted-foreground">
          {value.trim()
            ? <>Next run (UTC): <span className="text-foreground">{formatNextRun(value)}</span></>
            : 'Leave empty for a manual-only pipeline. Times are UTC · minute hour day-of-month month day-of-week.'}
        </p>
      </div>
    </div>
  );
}

export function Pipelines() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<PipelineResponse | null>(null);

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: pipelineApi.list,
  });

  const { data: recentRuns } = useQuery({
    queryKey: ['pipeline-runs-recent'],
    queryFn: () => pipelineApi.recentRuns(50),
    refetchInterval: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: pipelineApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline deleted');
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
  });

  const triggerMutation = useMutation({
    mutationFn: pipelineApi.trigger,
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs-recent'] });
      toast.success(`Pipeline run #${run.id} started`);
    },
    onError: (err: Error) => toast.error(`Failed to trigger: ${err.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      pipelineApi.toggle(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: Error) => toast.error(`Failed to toggle: ${err.message}`),
  });

  function getLastRunStatus(pipelineId: number) {
    if (!recentRuns) return null;
    return recentRuns.find((r) => r.pipelineId === pipelineId) ?? null;
  }

  function openEdit(pipeline: PipelineResponse) {
    navigate(`/pipelines/${pipeline.id}/edit`);
  }

  function openCreate() {
    navigate('/pipelines/new');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">
            Create and manage multi-step maintenance pipelines
          </p>
        </div>
        <Button onClick={openCreate} className="gradient-primary text-white border-0 hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Create Pipeline
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pipelines?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No pipelines configured</p>
            <p className="text-muted-foreground mb-4">
              Create your first pipeline to automate Iceberg table maintenance
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pipelines?.map((pipeline) => {
            const lastRun = getLastRunStatus(pipeline.id);
            return (
              <Card
                key={pipeline.id}
                className={cn(
                  'glass shadow-card transition-all hover:shadow-glow',
                  !pipeline.enabled && 'opacity-60',
                )}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/pipelines/${pipeline.id}`}
                        className="text-base font-semibold hover:underline truncate block"
                      >
                        {pipeline.name}
                      </Link>
                      {pipeline.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {pipeline.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {lastRun && <StatusBadge status={lastRun.status} kind="pipeline" />}
                      <Switch
                        checked={pipeline.enabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({
                            id: pipeline.id,
                            enabled: checked,
                          })
                        }
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Target */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {pipeline.catalogName}
                      <span className="mx-1 text-muted-foreground/50">/</span>
                      {pipeline.namespace}
                      <span className="mx-1 text-muted-foreground/50">/</span>
                      {pipeline.tableName}
                    </span>
                  </div>

                  {/* Cron + next run */}
                  {pipeline.cronExpression && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge variant="outline" className="font-mono text-xs">
                          {pipeline.cronExpression}
                        </Badge>
                      </div>
                      {pipeline.enabled && (
                        <span className="text-xs text-muted-foreground">
                          Next: <span className="font-medium text-foreground">{formatNextRun(pipeline.cronExpression)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Task flow */}
                  <PipelineFlow tasks={pipeline.tasks} compact />

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gradient-primary text-white border-0 hover:opacity-90"
                      onClick={() => triggerMutation.mutate(pipeline.id)}
                      disabled={triggerMutation.isPending || !pipeline.enabled}
                    >
                      {triggerMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Run Now
                    </Button>
                    <Link to={`/pipelines/${pipeline.id}`}>
                      <Button size="sm" variant="outline">
                        View Runs
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(pipeline)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(pipeline)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Create / Edit Pipeline Dialog ──

export function PipelineEditor() {
  const navigate = useNavigate();
  const { pipelineId } = useParams<{ pipelineId?: string }>();
  const isEdit = !!pipelineId;
  const queryClient = useQueryClient();

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => pipelineApi.get(Number(pipelineId)),
    enabled: isEdit,
  });

  const { data: catalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
  });

  const { data: sparkClusters } = useQuery({
    queryKey: ['spark-clusters'],
    queryFn: sparkClusterApi.list,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [catalogId, setCatalogId] = useState<string>('');
  const [namespace, setNamespace] = useState('');
  const [tableName, setTableName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [targetStage, setTargetStage] = useState<TargetStage>('catalog');

  const catalogIdNum = catalogId ? Number(catalogId) : null;
  const catalogReady = catalogIdNum != null && !isNaN(catalogIdNum);

  const { data: namespaces, isLoading: loadingNamespaces } = useQuery({
    queryKey: ['namespaces', catalogIdNum],
    queryFn: () => namespaceApi.list(catalogIdNum!),
    enabled: catalogReady,
  });

  const { data: tables, isLoading: loadingTables } = useQuery({
    queryKey: ['tables', catalogIdNum, namespace],
    queryFn: () => namespaceApi.listTables(catalogIdNum!, namespace),
    enabled: catalogReady && namespace.length > 0,
  });

  const namespaceNames = namespaces?.map((ns) => ns.name) ?? [];
  const namespaceOptions =
    namespace.length > 0 && !namespaceNames.includes(namespace)
      ? [namespace, ...namespaceNames]
      : namespaceNames;

  const tableOptions =
    tableName.length > 0 && tables && !tables.includes(tableName)
      ? [tableName, ...tables]
      : (tables ?? []);
  const catalogOptions: SearchCardOption[] = (catalogs ?? []).map((cat) => ({
    value: String(cat.id),
    label: cat.name,
    description: cat.uri,
    badge: cat.vendor,
  }));
  const namespaceCardOptions: SearchCardOption[] = namespaceOptions.map((ns) => ({
    value: ns,
    label: ns,
    description: `${ns} namespace`,
  }));
  const tableCardOptions: SearchCardOption[] = tableOptions.map((t) => ({
    value: t,
    label: t,
    description: `${namespace}.${t}`,
  }));
  const targetStageOptions: { id: TargetStage; label: string; ready: boolean }[] = [
    { id: 'catalog', label: catalogOptions.find((opt) => opt.value === catalogId)?.label ?? 'Catalog', ready: Boolean(catalogId) },
    { id: 'namespace', label: namespace || 'Namespace', ready: Boolean(namespace) },
    { id: 'table', label: tableName || 'Table', ready: Boolean(tableName) },
  ];

  // Reset form when dialog opens
  const resetForm = (p: PipelineResponse | null) => {
    if (p) {
      setName(p.name);
      setDescription(p.description ?? '');
      setCatalogId(String(p.catalogId));
      setNamespace(p.namespace);
      setTableName(p.tableName);
      setCronExpression(p.cronExpression ?? '');
      setEnabled(p.enabled);
      setTasks(
        p.tasks.length > 0
          ? [...p.tasks]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((t) => ({
                key: crypto.randomUUID(),
                name: t.name,
                actionType: t.actionType,
                parameters: { ...t.parameters },
              }))
          : [],
      );
      setWizardStep(0);
      setTargetStage('catalog');
    } else {
      setName('');
      setDescription('');
      setCatalogId('');
      setNamespace('');
      setTableName('');
      setCronExpression('');
      setEnabled(true);
      setTasks([]);
      setWizardStep(0);
      setTargetStage('catalog');
    }
  };

  // Populate the form from the fetched pipeline (edit), or start blank (create).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    resetForm(pipeline ?? null);
  }, [pipeline]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePipelineRequest) => pipelineApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      navigate('/pipelines');
      toast.success('Pipeline created');
    },
    onError: (err: Error) => toast.error(`Failed to create: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePipelineRequest }) =>
      pipelineApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      navigate('/pipelines');
      toast.success('Pipeline updated');
    },
    onError: (err: Error) => toast.error(`Failed to update: ${err.message}`),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedTask = tasks.find((t) => t.key === selectedTaskKey) ?? tasks[0];
  const canSubmit = Boolean(catalogId && namespace && tableName && name.trim() && tasks.length > 0);

  function canContinueStep(step = wizardStep): boolean {
    switch (WIZARD_STEPS[step]?.id) {
      case 'target':
        return Boolean(catalogId && namespace && tableName);
      case 'tasks':
        return tasks.length > 0;
      case 'schedule':
        return true;
      case 'details':
        return Boolean(name.trim());
      default:
        return false;
    }
  }

  function goNext() {
    if (!canContinueStep()) {
      toast.error('Complete this step before continuing.');
      return;
    }
    setWizardStep((step) => Math.min(step + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setWizardStep((step) => Math.max(step - 1, 0));
  }

  function addTask() {
    const t = createTaskDraft();
    setTasks((prev) => [...prev, t]);
    setSelectedTaskKey(t.key);
  }

  function removeTask(key: string) {
    setTasks((prev) => prev.filter((t) => t.key !== key));
  }

  function updateTask(key: string, updates: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...updates } : t)));
  }

  function setTaskEngine(task: TaskDraft, engine: 'java' | 'spark') {
    const next: Record<string, string> = { ...task.parameters, [ENGINE_PARAM]: engine };
    if (engine === 'java') delete next[SPARK_CLUSTER_PARAM];
    updateTask(task.key, { parameters: next });
  }

  function setTaskSparkCluster(task: TaskDraft, cluster: string) {
    const next: Record<string, string> = { ...task.parameters, [ENGINE_PARAM]: 'spark' };
    if (cluster === 'local') delete next[SPARK_CLUSTER_PARAM];
    else next[SPARK_CLUSTER_PARAM] = cluster;
    updateTask(task.key, { parameters: next });
  }

  function setReservedNumParam(task: TaskDraft, key: string, value: string) {
    const next = { ...task.parameters };
    const v = value.trim();
    if (v && Number(v) > 0) next[key] = String(Math.floor(Number(v)));
    else delete next[key];
    updateTask(task.key, { parameters: next });
  }

  function updateParam(task: TaskDraft, field: ActionParamField, displayVal: string) {
    const next = { ...task.parameters };
    if (displayVal.trim() === '') {
      delete next[field.key];
    } else {
      const num = Number(displayVal);
      next[field.key] = field.factor ? String(Math.round(num * field.factor)) : displayVal.trim();
    }
    updateTask(task.key, { parameters: next });
  }

  function handleCatalogChange(value: string) {
    setCatalogId(value);
    setNamespace('');
    setTableName('');
    setTargetStage('namespace');
  }

  function handleNamespaceChange(value: string) {
    setNamespace(value);
    setTableName('');
    setTargetStage('table');
  }

  function handleTableChange(value: string) {
    setTableName(value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error('Choose a catalog, namespace, table, at least one task, and a pipeline name.');
      return;
    }
    const data: CreatePipelineRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      catalogId: Number(catalogId),
      namespace: namespace.trim(),
      tableName: tableName.trim(),
      cronExpression: cronExpression.trim() || undefined,
      enabled,
      tasks: tasks
        .map((t) => {
          const params = cleanRewriteParams(t.parameters);
          const taskName = t.name.trim() || getActionMeta(t.actionType).label;
          return {
            name: taskName,
            actionType: t.actionType,
            parameters: Object.keys(params).length > 0 ? params : undefined,
          };
        }),
    };

    if (isEdit && pipeline) {
      updateMutation.mutate({ id: pipeline.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/pipelines')} className="text-muted-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Pipelines
        </Button>
        <h1 className="text-xl font-semibold">{isEdit ? 'Edit Pipeline' : 'Create Pipeline'}</h1>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {WIZARD_STEPS.map((step, idx) => {
                  const active = idx === wizardStep;
                  const done = idx < wizardStep && canContinueStep(idx);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setWizardStep(idx)}
                      className={cn(
                        'flex min-w-[120px] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                        active
                          ? 'border-indigo-500/50 bg-indigo-500/[0.08] ring-1 ring-indigo-500/30'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          active
                            ? 'bg-indigo-500 text-white'
                            : done
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{step.title}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{step.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          {wizardStep === 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm">
                {targetStageOptions.map((stage, idx) => {
                  const active = targetStage === stage.id;
                  const disabled =
                    (stage.id === 'namespace' && !catalogReady) ||
                    (stage.id === 'table' && !namespace);
                  return (
                    <React.Fragment key={stage.id}>
                      {idx > 0 && <span className="text-muted-foreground/35">/</span>}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setTargetStage(stage.id)}
                        className={cn(
                          'group min-w-0 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                          active
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className={cn(
                          'block max-w-[180px] truncate font-medium underline-offset-4 group-hover:underline',
                          active && 'underline decoration-indigo-500/70',
                        )}>
                          {stage.label}
                        </span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {targetStage === 'catalog' && (
                <SearchCardPicker
                  searchPlaceholder="Search catalogs..."
                  options={catalogOptions}
                  value={catalogId}
                  onChange={handleCatalogChange}
                  emptyLabel="No catalogs match your search."
                />
              )}

              {targetStage === 'namespace' && (
                <SearchCardPicker
                  searchPlaceholder="Search namespaces..."
                  options={namespaceCardOptions}
                  value={namespace}
                  onChange={handleNamespaceChange}
                  disabled={!catalogReady}
                  loading={loadingNamespaces}
                  emptyLabel={
                    !catalogReady
                      ? 'Select a catalog first.'
                      : namespaceOptions.length === 0
                        ? 'No namespaces found.'
                        : 'No namespaces match your search.'
                  }
                />
              )}

              {targetStage === 'table' && (
                <SearchCardPicker
                  searchPlaceholder="Search tables..."
                  options={tableCardOptions}
                  value={tableName}
                  onChange={handleTableChange}
                  disabled={!namespace}
                  loading={loadingTables}
                  emptyLabel={
                    !namespace
                      ? 'Select a namespace first.'
                      : tableOptions.length === 0
                        ? 'No tables found.'
                        : 'No tables match your search.'
                  }
                />
              )}
            </div>
          )}

          {/* 4 · Tasks — sequential flow; click a task to configure it below */}
          {wizardStep === 1 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Tasks</Label>
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
              {tasks.map((task, idx) => {
                const meta = getActionMeta(task.actionType);
                const Icon = meta.icon;
                const isSelected = selectedTask?.key === task.key;
                const paramCount = Object.keys(cleanRewriteParams(task.parameters)).length;
                return (
                  <React.Fragment key={task.key}>
                    {idx > 0 && (
                      <div className="flex items-center mx-2">
                        <div className="h-0.5 w-8 bg-muted-foreground/40" />
                        <svg width="8" height="12" viewBox="0 0 6 10" fill="none" className="-ml-px text-muted-foreground/50">
                          <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedTaskKey(task.key)}
                      className={cn(
                        'relative flex min-h-[74px] min-w-[175px] shrink-0 items-center gap-3 rounded-md border bg-card px-3 py-3 text-left transition-all',
                        'hover:ring-2 hover:ring-primary/30',
                        meta.borderColor,
                        isSelected && 'ring-2 ring-indigo-500/60 ring-offset-1 ring-offset-background',
                      )}
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', meta.bgColor, meta.borderColor)}>
                        <Icon className={cn('h-5 w-5', meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{task.name || `Step ${idx + 1}`}</p>
                        <p className="truncate text-[10px] text-muted-foreground">#{idx + 1} · {meta.label}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {paramCount} param{paramCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
              <div className="flex items-center mx-2">
                <div className="h-0.5 w-8 bg-muted-foreground/40" />
                <svg width="8" height="12" viewBox="0 0 6 10" fill="none" className="-ml-px text-muted-foreground/50">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <button
                type="button"
                onClick={addTask}
                className="flex min-w-[120px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 bg-card/50 px-4 text-sm font-medium text-muted-foreground transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.04] hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            </div>
            </div>

            {selectedTask && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Step {tasks.findIndex((t) => t.key === selectedTask.key) + 1} · configuration
                  </span>
                  {tasks.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => removeTask(selectedTask.key)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Task Name</Label>
                    <Input
                      value={selectedTask.name}
                      onChange={(e) => updateTask(selectedTask.key, { name: e.target.value })}
                      placeholder={getActionMeta(selectedTask.actionType).label}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Action Type</Label>
                    <Select
                      value={selectedTask.actionType}
                      onValueChange={(v) => {
                        const currentDefaultName = getActionMeta(selectedTask.actionType).label;
                        const shouldRename =
                          !selectedTask.name.trim() || selectedTask.name === currentDefaultName;
                        updateTask(selectedTask.key, {
                          actionType: v,
                          name: shouldRename ? getActionMeta(v).label : selectedTask.name,
                          parameters: v === 'REWRITE_DATA_FILES' ? { [ENGINE_PARAM]: 'java' } : {},
                        });
                      }}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((at) => {
                          const atMeta = getActionMeta(at);
                          const AtIcon = atMeta.icon;
                          return (
                            <SelectItem key={at} value={at}>
                              <AtIcon className={cn('mr-1.5 inline h-3.5 w-3.5', atMeta.color)} />
                              {atMeta.label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedTask.actionType === 'REWRITE_DATA_FILES' && (
                  <div className="grid gap-2 rounded-md border border-border/50 bg-background/40 p-2">
                    <Label className="text-xs">Execution engine</Label>
                    <Select value={taskEngine(selectedTask)} onValueChange={(v) => setTaskEngine(selectedTask, v as 'java' | 'spark')}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="java">Java API (small tables, in-process)</SelectItem>
                        <SelectItem value="spark">Spark (large / merge-on-read)</SelectItem>
                      </SelectContent>
                    </Select>
                    {taskEngine(selectedTask) === 'spark' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Spark target</Label>
                        <Select value={taskSparkCluster(selectedTask)} onValueChange={(v) => setTaskSparkCluster(selectedTask, v)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Local (local[*])</SelectItem>
                            {sparkClusters?.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name} <span className="text-muted-foreground">({c.masterUrl})</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {selectedTask.actionType === 'REWRITE_DATA_FILES' ? (
                  <RewriteOptionsEditor
                    params={Object.fromEntries(Object.entries(selectedTask.parameters).filter(([k]) => !RESERVED_PARAMS.includes(k)))}
                    onChange={(next) => {
                      const reserved: Record<string, string> = {};
                      for (const k of RESERVED_PARAMS) {
                        if (selectedTask.parameters[k]) reserved[k] = selectedTask.parameters[k];
                      }
                      updateTask(selectedTask.key, { parameters: { ...reserved, ...next } });
                    }}
                    engine={taskEngine(selectedTask)}
                  />
                ) : (ACTION_PARAMS[selectedTask.actionType] ?? []).length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 rounded-md border border-border/50 bg-background/40 p-2">
                    <span className="sm:col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parameters</span>
                    {ACTION_PARAMS[selectedTask.actionType].map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input type="number" min={0} value={paramDisplayValue(selectedTask.parameters, field)} onChange={(e) => updateParam(selectedTask, field, e.target.value)} placeholder={field.placeholder} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground">No parameters for this action.</p>
                )}

                {/* Retry on failure (all action types) */}
                <div className="grid gap-2 rounded-md border border-border/50 bg-background/40 p-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Retry on failure</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Retries</Label>
                      <Input type="number" min={0} placeholder="0"
                        value={selectedTask.parameters[RETRIES_PARAM] ?? ''}
                        onChange={(e) => setReservedNumParam(selectedTask, RETRIES_PARAM, e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delay between retries (s)</Label>
                      <Input type="number" min={0} placeholder="0"
                        value={selectedTask.parameters[RETRY_DELAY_PARAM] ?? ''}
                        onChange={(e) => setReservedNumParam(selectedTask, RETRY_DELAY_PARAM, e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Re-runs this task up to N extra times if it fails, waiting the delay between attempts.</p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 5 · Schedule */}
          {wizardStep === 2 && (
          <div className="space-y-4">
            <CronBuilder value={cronExpression} onChange={setCronExpression} />
            <div className="flex items-center gap-2 border-t border-border/50 pt-3">
              <Switch id="pipeline-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="pipeline-enabled">Enabled</Label>
            </div>
          </div>
          )}

          {/* 6 · Name & description */}
          {wizardStep === 3 && (
          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Pipeline Name</Label>
            <Input id="pipeline-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="daily-maintenance" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeline-desc">Description</Label>
            <Textarea id="pipeline-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="min-h-[60px]" />
          </div>
          </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/pipelines')}>Cancel</Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={goBack} disabled={wizardStep === 0}>
                Back
              </Button>
              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <Button type="button" onClick={goNext} disabled={!canContinueStep()}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isPending || !canSubmit}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? 'Update Pipeline' : 'Create Pipeline'}
                </Button>
              )}
            </div>
          </div>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}
