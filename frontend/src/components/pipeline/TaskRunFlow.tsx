import { Check, X, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineTaskRunResponse } from '@/types';
import { getActionMeta } from './PipelineFlow';
import { airflowState, AIRFLOW_LEGEND_ORDER, AIRFLOW_STATE } from './airflowStyle';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'SUCCESS':
      return <Check className="h-3 w-3" />;
    case 'FAILED':
      return <X className="h-3 w-3" />;
    case 'RUNNING':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'SKIPPED':
      return <Minus className="h-3 w-3" />;
    default:
      return <div className="h-1.5 w-1.5 rounded-full bg-current" />;
  }
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

interface TaskRunFlowProps {
  taskRuns: PipelineTaskRunResponse[];
  onSelect?: (taskRun: PipelineTaskRunResponse) => void;
}

export function TaskRunFlow({ taskRuns, onSelect }: TaskRunFlowProps) {
  const sorted = [...taskRuns].sort((a, b) => a.orderIndex - b.orderIndex);

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No task runs</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-0 overflow-x-auto p-3">
        {sorted.map((taskRun, idx) => {
          const meta = getActionMeta(taskRun.actionType);
          const st = airflowState(taskRun.status);
          const Icon = meta.icon;
          const skipped = taskRun.status === 'SKIPPED';
          return (
            <div key={taskRun.id} className="flex items-center shrink-0">
              {idx > 0 && (
                <div className="flex items-center mx-2">
                  <div className={cn('w-8 h-0.5', skipped ? 'border-t-2 border-dashed border-muted-foreground/40' : 'bg-muted-foreground/40')} />
                  <svg width="8" height="12" viewBox="0 0 6 10" fill="none" className="text-muted-foreground/50 -ml-px">
                    <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {/* Airflow-style task node: rounded box with a state-coloured border + status bar */}
              <div
                role={onSelect ? 'button' : undefined}
                onClick={onSelect ? () => onSelect(taskRun) : undefined}
                className={cn(
                  'relative overflow-hidden rounded-md border-2 bg-card min-w-[140px] transition-all',
                  taskRun.status === 'RUNNING' && 'animate-pulse',
                  skipped && 'opacity-70',
                  onSelect && 'cursor-pointer hover:ring-2 hover:ring-primary/40',
                )}
                style={{ borderColor: st.color }}
                title={onSelect ? `${taskRun.taskName} · ${st.label} — click for output` : `${taskRun.taskName} · ${st.label}`}
              >
                {/* state bar */}
                <div className="flex items-center justify-between px-2 py-1" style={{ backgroundColor: st.color, color: st.fg }}>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                    <StatusIcon status={taskRun.status} />
                    {st.label}
                  </span>
                  <span className="text-[10px] font-mono opacity-80">{formatDuration(taskRun.startedAt, taskRun.finishedAt)}</span>
                </div>
                {/* body */}
                <div className="flex items-center gap-2 border-t border-border/40 bg-card px-2.5 py-2">
                  <Icon className={cn('h-4 w-4 shrink-0', meta.color)} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{taskRun.taskName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{meta.label}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <AirflowLegend />
    </div>
  );
}

export function AirflowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">States</span>
      {AIRFLOW_LEGEND_ORDER.map((key) => {
        const st = AIRFLOW_STATE[key];
        return (
          <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: st.color }} />
            {st.label}
          </span>
        );
      })}
    </div>
  );
}
