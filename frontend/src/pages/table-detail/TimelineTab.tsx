import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { executionApi } from '@/api/client';
import { OperationOutputDialog } from '@/components/OperationOutputDialog';
import type { SnapshotInfo, ExecutionInfo } from '@/types';

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
  eraser:   '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
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
  REWRITE_POSITION_DELETE_FILES: { color: '#06b6d4', icon: 'eraser' },
  REWRITE_EQUALITY_DELETE_FILES: { color: '#14b8a6', icon: 'scissors' },
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

export function TimelineTab({ catalogId, namespace, table, snapshots }: {
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

      const seenIds = new Set<string>();
      for (const snap of snapshots) {
        if (hiddenTypes.has(snap.operation)) continue;
        const id = `snap-${snap.snapshotId}`;
        if (seenIds.has(id)) continue; // Nessie can map several commits to one snapshot id
        seenIds.add(id);
        const m = VIS_META[snap.operation] ?? VIS_DEFAULT_META;
        const detail = [
          snap.summary['added-data-files'] && `+${snap.summary['added-data-files']} files`,
          snap.summary['added-records'] && `+${snap.summary['added-records']} records`,
        ].filter(Boolean).join(' · ') || undefined;
        items.add({
          id,
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
