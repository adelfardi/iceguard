import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { airflowState } from '@/components/pipeline/airflowStyle';

export type StatusBadgeKind = 'execution' | 'alert' | 'pipeline';

const EXECUTION_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUCCESS: 'default',
  RUNNING: 'secondary',
  FAILED: 'destructive',
  PENDING: 'outline',
  CANCELLED: 'outline',
};

const ALERT_CLASSES: Record<string, string> = {
  OK: 'bg-emerald-500/10 text-emerald-400 border-0',
  TRIGGERED: 'bg-red-500/10 text-red-400 border-0',
  ACKNOWLEDGED: 'bg-blue-500/10 text-blue-400 border-0',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-0',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  kind?: StatusBadgeKind;
  className?: string;
}

export function StatusBadge({ status, kind = 'execution', className }: StatusBadgeProps) {
  if (!status) {
    return <Badge variant="secondary" className={className}>N/A</Badge>;
  }

  if (kind === 'pipeline') {
    const st = airflowState(status);
    return (
      <span
        className={cn(
          'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
          status === 'RUNNING' && 'animate-pulse',
          className,
        )}
        style={{ backgroundColor: st.color, color: st.fg }}
      >
        {st.label}
      </span>
    );
  }

  if (kind === 'alert') {
    const alertClass = ALERT_CLASSES[status];
    if (alertClass) {
      return <Badge className={cn(alertClass, className)}>{status}</Badge>;
    }
    return <Badge variant="secondary" className={className}>{status}</Badge>;
  }

  return (
    <Badge variant={EXECUTION_VARIANTS[status] ?? 'outline'} className={className}>
      {status}
    </Badge>
  );
}
