import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AlertEventResponse } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const STATUSES = ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED'] as const;

/**
 * Client-side filtered + paginated list of alert events. Each item is rendered
 * by the caller via `renderItem`, so it works for any layout (page or tab).
 * Filters: status (acknowledged or not, …) and a triggered-at date interval.
 */
export function AlertEventsList({
  events,
  renderItem,
  pageSize = 8,
  emptyState,
}: {
  events: AlertEventResponse[];
  renderItem: (event: AlertEventResponse) => ReactNode;
  pageSize?: number;
  emptyState?: ReactNode;
}) {
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return events.filter((e) => {
      if (status !== 'all' && e.status !== status) return false;
      const ts = e.triggeredAt ? new Date(e.triggeredAt).getTime() : 0;
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [events, status, from, to]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const hasFilters = status !== 'all' || !!from || !!to;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} max={to || undefined} className="h-8 w-[150px]"
            onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} min={from || undefined} className="h-8 w-[150px]"
            onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8"
            onClick={() => { setStatus('all'); setFrom(''); setTo(''); setPage(0); }}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {total > 0 ? `${currentPage * pageSize + 1}–${Math.min(total, (currentPage + 1) * pageSize)} of ${total}` : '0'}
        </span>
      </div>

      {/* List */}
      {events.length === 0 ? (
        emptyState ?? <p className="py-8 text-center text-sm text-muted-foreground">No alert events</p>
      ) : total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No alert events match these filters</p>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((e) => <Fragment key={e.id}>{renderItem(e)}</Fragment>)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Page {currentPage + 1} / {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8" disabled={currentPage <= 0}
                  onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" className="h-8" disabled={currentPage + 1 >= totalPages}
                  onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
