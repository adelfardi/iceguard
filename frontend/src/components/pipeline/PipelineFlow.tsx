import { Camera, FileStack, HardDrive, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineTaskResponse } from '@/types';

export const ACTION_TYPE_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bgColor: string; borderColor: string }
> = {
  EXPIRE_SNAPSHOTS: {
    label: 'Expire Snapshots',
    icon: Camera,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  REWRITE_MANIFESTS: {
    label: 'Rewrite Manifests',
    icon: FileStack,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  REWRITE_DATA_FILES: {
    label: 'Rewrite Data Files',
    icon: HardDrive,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  REMOVE_ORPHAN_FILES: {
    label: 'Remove Orphan Files',
    icon: Trash2,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
  },
  ROLLBACK: {
    label: 'Rollback',
    icon: Undo2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
};

export function getActionMeta(actionType: string) {
  return (
    ACTION_TYPE_META[actionType] ?? {
      label: actionType,
      icon: HardDrive,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      borderColor: 'border-border',
    }
  );
}

interface PipelineFlowProps {
  tasks: PipelineTaskResponse[];
  compact?: boolean;
}

export function PipelineFlow({ tasks, compact = false }: PipelineFlowProps) {
  const sorted = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No tasks configured</p>
    );
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {sorted.map((task, idx) => {
        const meta = getActionMeta(task.actionType);
        const Icon = meta.icon;
        return (
          <div key={task.id} className="flex items-center shrink-0">
            {idx > 0 && (
              <div className="flex items-center mx-1.5">
                <div className="w-5 h-0.5 bg-muted-foreground/40" />
                <svg
                  width="7"
                  height="11"
                  viewBox="0 0 6 10"
                  fill="none"
                  className="text-muted-foreground/50 -ml-px"
                >
                  <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {compact ? (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-md border-2 bg-card px-2 py-1 transition-all',
                  meta.borderColor,
                )}
                title={`${task.name} (${meta.label})`}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
                <span className="text-xs font-medium truncate max-w-[80px]">{task.name}</span>
              </div>
            ) : (
              /* Airflow-style operator node */
              <div
                className={cn(
                  'overflow-hidden rounded-md border-2 bg-card min-w-[150px] transition-all',
                  meta.borderColor,
                )}
              >
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1', meta.bgColor)}>
                  <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide', meta.color)}>{meta.label}</span>
                </div>
                <div className="border-t border-border/40 bg-card px-2.5 py-2">
                  <p className="text-sm font-medium truncate text-foreground">{task.name}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
