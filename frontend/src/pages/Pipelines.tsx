import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PipelineFlow, ACTION_TYPE_META, getActionMeta } from '@/components/pipeline/PipelineFlow';
import { StatusBadge } from '@/components/ui/status-badge';

const ACTION_TYPES = Object.keys(ACTION_TYPE_META);

const ENGINE_PARAM = 'engine';
const SPARK_CLUSTER_PARAM = 'sparkClusterId';

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
  REWRITE_DATA_FILES: [
    { key: 'target-file-size-bytes', label: 'Target file size (MB)', placeholder: '512', factor: 1_048_576 },
    { key: 'min-input-files', label: 'Min input files', placeholder: '5' },
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

function createTaskDraft(): TaskDraft {
  return {
    key: crypto.randomUUID(),
    name: '',
    actionType: ACTION_TYPES[0],
    parameters: {},
  };
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

export function Pipelines() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineResponse | null>(null);
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
    setEditingPipeline(pipeline);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingPipeline(null);
    setDialogOpen(true);
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

      {/* Create / Edit Dialog */}
      <PipelineFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipeline={editingPipeline}
      />

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

function PipelineFormDialog({
  open,
  onOpenChange,
  pipeline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: PipelineResponse | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!pipeline;

  const { data: catalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
    enabled: open,
  });

  const { data: sparkClusters } = useQuery({
    queryKey: ['spark-clusters'],
    queryFn: sparkClusterApi.list,
    enabled: open,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [catalogId, setCatalogId] = useState<string>('');
  const [namespace, setNamespace] = useState('');
  const [tableName, setTableName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [tasks, setTasks] = useState<TaskDraft[]>([createTaskDraft()]);

  const catalogIdNum = catalogId ? Number(catalogId) : null;
  const catalogReady = catalogIdNum != null && !isNaN(catalogIdNum);

  const { data: namespaces, isLoading: loadingNamespaces } = useQuery({
    queryKey: ['namespaces', catalogIdNum],
    queryFn: () => namespaceApi.list(catalogIdNum!),
    enabled: open && catalogReady,
  });

  const { data: tables, isLoading: loadingTables } = useQuery({
    queryKey: ['tables', catalogIdNum, namespace],
    queryFn: () => namespaceApi.listTables(catalogIdNum!, namespace),
    enabled: open && catalogReady && namespace.length > 0,
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
          : [createTaskDraft()],
      );
    } else {
      setName('');
      setDescription('');
      setCatalogId('');
      setNamespace('');
      setTableName('');
      setCronExpression('');
      setEnabled(true);
      setTasks([createTaskDraft()]);
    }
  };

  // Reset form when pipeline prop changes or dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) {
      resetForm(pipeline);
    }
  }, [open, pipeline]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePipelineRequest) => pipelineApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      onOpenChange(false);
      toast.success('Pipeline created');
    },
    onError: (err: Error) => toast.error(`Failed to create: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePipelineRequest }) =>
      pipelineApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      onOpenChange(false);
      toast.success('Pipeline updated');
    },
    onError: (err: Error) => toast.error(`Failed to update: ${err.message}`),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function addTask() {
    setTasks((prev) => [...prev, createTaskDraft()]);
  }

  function removeTask(key: string) {
    setTasks((prev) => prev.filter((t) => t.key !== key));
  }

  function updateTask(key: string, updates: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...updates } : t)));
  }

  function setTaskEngine(task: TaskDraft, engine: 'java' | 'spark') {
    const next = { ...task.parameters, [ENGINE_PARAM]: engine };
    if (engine === 'java') delete next[SPARK_CLUSTER_PARAM];
    updateTask(task.key, { parameters: next });
  }

  function setTaskSparkCluster(task: TaskDraft, cluster: string) {
    const next = { ...task.parameters, [ENGINE_PARAM]: 'spark' };
    if (cluster === 'local') delete next[SPARK_CLUSTER_PARAM];
    else next[SPARK_CLUSTER_PARAM] = cluster;
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
  }

  function handleNamespaceChange(value: string) {
    setNamespace(value);
    setTableName('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: CreatePipelineRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      catalogId: Number(catalogId),
      namespace: namespace.trim(),
      tableName: tableName.trim(),
      cronExpression: cronExpression.trim() || undefined,
      enabled,
      tasks: tasks
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          actionType: t.actionType,
          parameters: Object.keys(t.parameters).length > 0 ? t.parameters : undefined,
        })),
    };

    if (isEdit && pipeline) {
      updateMutation.mutate({ id: pipeline.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Pipeline' : 'Create Pipeline'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="daily-maintenance"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pipeline-catalog">Catalog</Label>
              <Select value={catalogId} onValueChange={handleCatalogChange} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select catalog" />
                </SelectTrigger>
                <SelectContent>
                  {catalogs?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline-desc">Description</Label>
            <Textarea
              id="pipeline-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="min-h-[60px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pipeline-ns">Namespace</Label>
              <Select
                value={namespace || undefined}
                onValueChange={handleNamespaceChange}
                disabled={!catalogReady || loadingNamespaces}
                required
              >
                <SelectTrigger id="pipeline-ns" className="w-full">
                  <SelectValue
                    placeholder={
                      !catalogReady
                        ? 'Select a catalog first'
                        : loadingNamespaces
                          ? 'Loading namespaces…'
                          : namespaceOptions.length === 0
                            ? 'No namespaces'
                            : 'Select namespace'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {namespaceOptions.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pipeline-table">Table</Label>
              <Select
                value={tableName || undefined}
                onValueChange={setTableName}
                disabled={!namespace || loadingTables}
                required
              >
                <SelectTrigger id="pipeline-table" className="w-full">
                  <SelectValue
                    placeholder={
                      !namespace
                        ? 'Select a namespace first'
                        : loadingTables
                          ? 'Loading tables…'
                          : tableOptions.length === 0
                            ? 'No tables'
                            : 'Select table'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tableOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pipeline-cron">Cron Expression</Label>
              <Input
                id="pipeline-cron"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 2 * * * (optional)"
                className="font-mono"
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="pipeline-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="pipeline-enabled">Enabled</Label>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Tasks</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Task
              </Button>
            </div>

            <div className="space-y-2">
              {tasks.map((task, idx) => {
                const meta = getActionMeta(task.actionType);
                const Icon = meta.icon;
                return (
                  <div
                    key={task.key}
                    className="relative"
                  >
                    {/* Connecting line */}
                    {idx > 0 && (
                      <div className="absolute left-5 -top-2 w-px h-2 bg-muted-foreground/20" />
                    )}
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 transition-all',
                        meta.bgColor,
                        meta.borderColor,
                      )}
                    >
                      {/* Step number */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold',
                          meta.borderColor,
                          meta.color,
                        )}>
                          {idx + 1}
                        </div>
                        <Icon className={cn('h-4 w-4', meta.color)} />
                      </div>

                      {/* Fields */}
                      <div className="flex-1 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Task Name</Label>
                            <Input
                              value={task.name}
                              onChange={(e) => updateTask(task.key, { name: e.target.value })}
                              placeholder={`Step ${idx + 1}`}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Action Type</Label>
                            <Select
                              value={task.actionType}
                              onValueChange={(v) =>
                                updateTask(task.key, {
                                  actionType: v,
                                  parameters: v === 'REWRITE_DATA_FILES' ? { [ENGINE_PARAM]: 'java' } : {},
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map((at) => {
                                  const atMeta = getActionMeta(at);
                                  const AtIcon = atMeta.icon;
                                  return (
                                    <SelectItem key={at} value={at}>
                                      <AtIcon className={cn('h-3.5 w-3.5 mr-1.5 inline', atMeta.color)} />
                                      {atMeta.label}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {task.actionType === 'REWRITE_DATA_FILES' && (
                          <div className="grid gap-2 sm:grid-cols-2 rounded-md border border-border/50 bg-background/40 p-2">
                            <span className="sm:col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Engine</span>
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Execution engine</Label>
                              <Select
                                value={taskEngine(task)}
                                onValueChange={(v) => setTaskEngine(task, v as 'java' | 'spark')}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="java">Java API (analyse only)</SelectItem>
                                  <SelectItem value="spark">Spark (real compaction)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {taskEngine(task) === 'spark' && (
                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-xs">Spark target</Label>
                                <Select
                                  value={taskSparkCluster(task)}
                                  onValueChange={(v) => setTaskSparkCluster(task, v)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="local">Local (local[*])</SelectItem>
                                    {sparkClusters?.map((c) => (
                                      <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}{' '}
                                        <span className="text-muted-foreground">({c.masterUrl})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                  Configure clusters in Settings · Spark must be installed for execution.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Parameters (like the Maintenance tab) */}
                        {(ACTION_PARAMS[task.actionType] ?? []).length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2 rounded-md border border-border/50 bg-background/40 p-2">
                            <span className="sm:col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parameters</span>
                            {ACTION_PARAMS[task.actionType].map((field) => (
                              <div key={field.key} className="space-y-1">
                                <Label className="text-xs">{field.label}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={paramDisplayValue(task.parameters, field)}
                                  onChange={(e) => updateParam(task, field, e.target.value)}
                                  placeholder={field.placeholder}
                                />
                              </div>
                            ))}
                          </div>
                        ) : task.actionType !== 'REWRITE_DATA_FILES' ? (
                          <p className="text-[11px] text-muted-foreground italic">No parameters for this action.</p>
                        ) : null}
                      </div>

                      {/* Remove */}
                      {tasks.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 mt-1 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTask(task.key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update Pipeline' : 'Create Pipeline'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
