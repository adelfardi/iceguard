import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera, Database, Eraser, FileStack, History, Loader2, Paintbrush, Plus, RefreshCw, Repeat, Scissors, Trash2, Undo2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { maintenanceApi, apiErrorMessage } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClientPagination } from '@/components/common/ClientPagination';
import { cn } from '@/lib/utils';
import type { SnapshotInfo } from '@/types';

const SNAPSHOT_PAGE_SIZE = 10;

/* Snapshot operation → icon + color, kept in sync with the timeline's VIS_META. */
const SNAPSHOT_OP_META: Record<string, { Icon: typeof Plus; className: string }> = {
  append: { Icon: Plus, className: 'text-emerald-400' },
  overwrite: { Icon: RefreshCw, className: 'text-blue-400' },
  replace: { Icon: Repeat, className: 'text-cyan-400' },
  delete: { Icon: Trash2, className: 'text-red-400' },
  EXPIRE_SNAPSHOTS: { Icon: Camera, className: 'text-violet-400' },
  REWRITE_MANIFESTS: { Icon: FileStack, className: 'text-amber-400' },
  REWRITE_DATA_FILES: { Icon: Database, className: 'text-emerald-400' },
  REWRITE_POSITION_DELETE_FILES: { Icon: Eraser, className: 'text-cyan-400' },
  REWRITE_EQUALITY_DELETE_FILES: { Icon: Scissors, className: 'text-teal-400' },
  REMOVE_ORPHAN_FILES: { Icon: Paintbrush, className: 'text-rose-400' },
  ROLLBACK: { Icon: Undo2, className: 'text-blue-400' },
};

function SnapshotOperationBadge({ operation }: { operation: string }) {
  const meta = SNAPSHOT_OP_META[operation] ?? { Icon: Zap, className: 'text-slate-400' };
  const { Icon } = meta;
  return (
    <Badge className="bg-violet-500/10 text-violet-400 border-0 gap-1">
      <Icon className={cn('h-3.5 w-3.5', meta.className)} />
      {operation}
    </Badge>
  );
}

/** Paginated snapshot table (newest first) with a details dialog and rollback. */
export function SnapshotsList({ catalogId, namespace, table, snapshots }: {
  catalogId: number; namespace: string; table: string; snapshots: SnapshotInfo[];
}) {
  const queryClient = useQueryClient();
  const [detailSnapshot, setDetailSnapshot] = useState<SnapshotInfo | null>(null);
  const [snapshotPage, setSnapshotPage] = useState(0);

  const snapshotList = React.useMemo(
    () => [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [snapshots],
  );
  // Clamp at render time: the list can shrink (rollback, refetch) under the current page.
  const maxPage = Math.max(0, Math.ceil(snapshotList.length / SNAPSHOT_PAGE_SIZE) - 1);
  const page = Math.min(snapshotPage, maxPage);
  const pagedSnapshots = snapshotList.slice(page * SNAPSHOT_PAGE_SIZE, (page + 1) * SNAPSHOT_PAGE_SIZE);

  const rollbackMutation = useMutation({
    mutationFn: (snapshotId: string) => maintenanceApi.rollback(catalogId, namespace, table, { snapshotId }),
    onSuccess: () => {
      toast.success('Table positioned on snapshot');
      for (const key of ['snapshots', 'table', 'table-stats', 'table-versioning']) {
        queryClient.invalidateQueries({ queryKey: [key, catalogId, namespace, table] });
      }
      setDetailSnapshot(null);
    },
    onError: (err: Error) => toast.error(`Rollback failed: ${apiErrorMessage(err)}`),
  });

  return (
    <>
      {snapshotList.length === 0 ? <p className="text-muted-foreground py-4 text-center">No snapshots</p> : (
        <>
          <UiTable><TableHeader><TableRow><TableHead>Snapshot ID</TableHead><TableHead>Timestamp</TableHead><TableHead>Operation</TableHead><TableHead>Added Files</TableHead><TableHead>Added Records</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
            <TableBody>{pagedSnapshots.map((snap) => (
              <TableRow key={snap.snapshotId}>
                <TableCell className="font-mono text-sm text-blue-400">{snap.snapshotId}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(snap.timestamp).toLocaleString()}</TableCell>
                <TableCell><SnapshotOperationBadge operation={snap.operation} /></TableCell>
                <TableCell className="text-emerald-400 font-medium">{snap.summary['added-data-files'] ?? '-'}</TableCell>
                <TableCell className="text-amber-400 font-medium">{snap.summary['added-records'] ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setDetailSnapshot(snap)}>Details</Button>
                </TableCell>
              </TableRow>
            ))}</TableBody></UiTable>
          <ClientPagination page={page} pageSize={SNAPSHOT_PAGE_SIZE} total={snapshotList.length} onPageChange={setSnapshotPage} />
        </>
      )}

      <Dialog open={detailSnapshot !== null} onOpenChange={(o) => { if (!o) setDetailSnapshot(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4 text-violet-500" /> Snapshot details</DialogTitle>
          </DialogHeader>
          {detailSnapshot && (
            <div className="space-y-3">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">Snapshot ID</span><span className="font-mono break-all">{detailSnapshot.snapshotId}</span>
                <span className="text-muted-foreground">Parent</span><span className="font-mono break-all">{detailSnapshot.parentSnapshotId ?? '—'}</span>
                <span className="text-muted-foreground">Operation</span><span><SnapshotOperationBadge operation={detailSnapshot.operation} /></span>
                <span className="text-muted-foreground">Timestamp</span><span>{new Date(detailSnapshot.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {Object.entries(detailSnapshot.summary).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3 text-xs">
                      <span className="shrink-0 font-mono text-muted-foreground">{k}</span>
                      <span className="min-w-0 break-all text-right font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="destructive" disabled={rollbackMutation.isPending}
                  onClick={() => rollbackMutation.mutate(detailSnapshot.snapshotId)}>
                  {rollbackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <History className="mr-2 h-4 w-4" /> Position table on this snapshot
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
