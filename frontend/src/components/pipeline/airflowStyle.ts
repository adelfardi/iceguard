/**
 * Apache Airflow task-state palette, mapped onto IceGuard's run statuses.
 * Colours follow Airflow's canonical STATE_COLORS legend (success=green,
 * running=lime, failed=red, queued=gray, skipped=pink, removed=lightgrey),
 * tuned for a dark UI. `fg` is the readable text colour on top of `color`.
 */
export interface AirflowState {
  /** Airflow state name shown in the legend. */
  label: string;
  color: string;
  fg: string;
}

export const AIRFLOW_STATE: Record<string, AirflowState> = {
  PENDING:   { label: 'queued',  color: '#9ca3af', fg: '#111827' }, // gray
  RUNNING:   { label: 'running', color: '#84cc16', fg: '#111827' }, // lime
  SUCCESS:   { label: 'success', color: '#16a34a', fg: '#ffffff' }, // green
  FAILED:    { label: 'failed',  color: '#ef4444', fg: '#ffffff' }, // red
  SKIPPED:   { label: 'skipped', color: '#ec4899', fg: '#ffffff' }, // pink
  CANCELLED: { label: 'removed', color: '#d1d5db', fg: '#111827' }, // lightgrey
};

export function airflowState(status: string): AirflowState {
  return AIRFLOW_STATE[status] ?? AIRFLOW_STATE.PENDING;
}

/** Order shown in the legend. */
export const AIRFLOW_LEGEND_ORDER = ['SUCCESS', 'RUNNING', 'FAILED', 'PENDING', 'SKIPPED', 'CANCELLED'];
