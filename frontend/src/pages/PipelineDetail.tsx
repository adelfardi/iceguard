import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/api/client';
import type { PipelineRunResponse, PipelineTaskRunResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Play,
  Loader2,
  Clock,
  Database,
  User,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PipelineFlow } from '@/components/pipeline/PipelineFlow';
import { TaskRunFlow } from '@/components/pipeline/TaskRunFlow';
import { airflowState } from '@/components/pipeline/airflowStyle';
import { StatusBadge } from '@/components/ui/status-badge';
import { OperationOutputDialog } from '@/components/OperationOutputDialog';

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export function PipelineDetail() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const id = Number(pipelineId);
  const queryClient = useQueryClient();
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [selectedTaskRun, setSelectedTaskRun] = useState<PipelineTaskRunResponse | null>(null);

  const { data: pipeline, isLoading: loadingPipeline } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => pipelineApi.get(id),
    enabled: !isNaN(id),
  });

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ['pipeline-runs', id],
    queryFn: () => pipelineApi.listRuns(id),
    enabled: !isNaN(id),
    refetchInterval: 5000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => pipelineApi.trigger(id),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs', id] });
      toast.success(`Pipeline run #${run.id} started`);
    },
    onError: (err: Error) => toast.error(`Failed to trigger: ${err.message}`),
  });

  function toggleRun(runId: number) {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  if (loadingPipeline) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="space-y-6">
        <Link to="/pipelines" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Pipelines
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Pipeline not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        to="/pipelines"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Pipelines
      </Link>

      {/* Pipeline info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{pipeline.name}</CardTitle>
              {pipeline.description && (
                <p className="text-sm text-muted-foreground mt-1">{pipeline.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={pipeline.enabled ? 'default' : 'outline'}>
                {pipeline.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                size="sm"
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending || !pipeline.enabled}
              >
                {triggerMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                Run Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              <span>
                {pipeline.catalogName} / {pipeline.namespace} / {pipeline.tableName}
              </span>
            </div>
            {pipeline.cronExpression && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <Badge variant="outline" className="font-mono text-xs">
                  {pipeline.cronExpression}
                </Badge>
              </div>
            )}
          </div>

          {/* Visual pipeline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Task Flow
            </p>
            <PipelineFlow tasks={pipeline.tasks} />
          </div>
        </CardContent>
      </Card>

      {/* Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRuns ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !runs || runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Play className="mx-auto h-8 w-8 mb-2" />
              <p>No runs yet</p>
              <p className="text-sm">Trigger a run to see results here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  expanded={expandedRuns.has(run.id)}
                  onToggle={() => toggleRun(run.id)}
                  onSelectTask={setSelectedTaskRun}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OperationOutputDialog
        open={selectedTaskRun !== null}
        onOpenChange={(o) => { if (!o) setSelectedTaskRun(null); }}
        title={selectedTaskRun?.taskName ?? ''}
        actionType={selectedTaskRun?.actionType}
        status={selectedTaskRun?.status}
        startedAt={selectedTaskRun?.startedAt}
        finishedAt={selectedTaskRun?.finishedAt}
        result={selectedTaskRun?.result}
        errorMessage={selectedTaskRun?.errorMessage}
      />
    </div>
  );
}

function RunCard({
  run,
  expanded,
  onToggle,
  onSelectTask,
}: {
  run: PipelineRunResponse;
  expanded: boolean;
  onToggle: () => void;
  onSelectTask: (taskRun: PipelineTaskRunResponse) => void;
}) {
  return (
    <div className={cn(
      'rounded-lg border transition-all',
      run.status === 'RUNNING' && 'border-blue-500/30',
      run.status === 'FAILED' && 'border-red-500/30',
    )}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent rounded-lg transition-all duration-150"
      >
        <div className="flex items-center gap-4">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Run #{run.id}</span>
              <StatusBadge status={run.status} kind="pipeline" />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {run.triggeredBy}
              </span>
              <span>{formatDateTime(run.startedAt)}</span>
              {run.startedAt && (
                <span className="font-mono">
                  {formatDuration(run.startedAt, run.finishedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini status dots */}
        {!expanded && run.taskRuns.length > 0 && (
          <div className="flex items-center gap-1">
            {[...run.taskRuns]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((tr) => (
                <div
                  key={tr.id}
                  className={cn('h-2.5 w-2.5 rounded-sm', tr.status === 'RUNNING' && 'animate-pulse')}
                  style={{ backgroundColor: airflowState(tr.status).color }}
                  title={`${tr.taskName}: ${airflowState(tr.status).label}`}
                />
              ))}
          </div>
        )}
      </button>

      {expanded && run.taskRuns.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t ml-6">
          <TaskRunFlow taskRuns={run.taskRuns} onSelect={onSelectTask} />

          {/* Error messages */}
          {run.taskRuns
            .filter((tr) => tr.errorMessage)
            .map((tr) => (
              <div
                key={tr.id}
                className="mt-3 rounded-md bg-red-500/10 border border-red-500/20 p-3"
              >
                <p className="text-xs font-semibold text-red-400 mb-1">
                  {tr.taskName} - Error
                </p>
                <p className="text-xs text-red-300 font-mono whitespace-pre-wrap">
                  {tr.errorMessage}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
