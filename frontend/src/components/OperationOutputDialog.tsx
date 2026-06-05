import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperationOutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actionType?: string;
  status?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

function formatDuration(startedAt?: string | null, finishedAt?: string | null): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/** Long multi-line values (e.g. Spark job log, stderr) are rendered as a scrollable code block. */
const LONG_KEYS = new Set(['output', 'call', 'error', 'stderr', 'stacktrace', 'stackTrace', 'message', 'log']);

function isLongValue(key: string, v: unknown): boolean {
  if (LONG_KEYS.has(key)) return true;
  return typeof v === 'string' && v.length > 80;
}

function LogBlock({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <ScrollArea className={cn('rounded-md border border-border/60 bg-muted/30', className)}>
        <pre className="p-3 pr-4 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
          {children}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function OperationOutputDialog({
  open, onOpenChange, title, actionType, status, startedAt, finishedAt, result, errorMessage,
}: OperationOutputDialogProps) {
  const entries = Object.entries(result ?? {});
  const longEntries = entries.filter(([k, v]) => isLongValue(k, v));
  const shortEntries = entries.filter((e) => !longEntries.includes(e));
  const duration = formatDuration(startedAt, finishedAt);
  const failed = status?.toUpperCase() === 'FAILED';
  const logMaxH = failed ? 'max-h-[min(50vh,28rem)]' : 'max-h-72';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex w-[calc(100%-2rem)] max-h-[min(90vh,52rem)] flex-col gap-0 overflow-hidden p-0',
          'sm:max-w-4xl',
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/50 px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-base">
            <span className="capitalize">{title}</span>
            {status && <StatusBadge status={status} kind="pipeline" />}
          </DialogTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-normal">
            {actionType && (
              <span>
                Action: <span className="text-foreground font-medium">{actionType}</span>
              </span>
            )}
            {startedAt && <span>Started: {new Date(startedAt).toLocaleString()}</span>}
            {finishedAt && <span>Finished: {new Date(finishedAt).toLocaleString()}</span>}
            {duration && (
              <span>
                Duration: <span className="text-foreground">{duration}</span>
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 px-6 py-4 text-sm">
            {errorMessage && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Error
                </p>
                <ScrollArea className={cn('rounded-md border border-destructive/30 bg-destructive/10', logMaxH)}>
                  <pre className="p-3 pr-4 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-destructive">
                    {errorMessage}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {shortEntries.length > 0 && (
              <div className="rounded-md border border-border/60 divide-y divide-border/40">
                {shortEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{k}</span>
                    <span className="text-xs text-foreground text-right break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {longEntries.map(([k, v]) => (
              <LogBlock key={k} label={k} className={logMaxH}>
                {String(v)}
              </LogBlock>
            ))}

            {entries.length === 0 && !errorMessage && (
              <p className="text-center text-muted-foreground py-8 text-xs">
                No output recorded for this operation.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
