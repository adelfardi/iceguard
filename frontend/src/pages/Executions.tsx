import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { executionApi, catalogApi, namespaceApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table as UiTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ExecutionSearchParams } from '@/types';

const ALL = '__all__';
const PAGE_SIZE = 20;
const STATUSES = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'];

/** Local yyyy-MM-dd → ISO instant at the start (00:00) or end (23:59:59.999) of that local day. */
function dayToInstant(day: string, edge: 'start' | 'end'): string | undefined {
  if (!day) return undefined;
  const time = edge === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  const d = new Date(`${day}${time}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function Executions() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter state is the single source of truth in the URL (deep-linkable). ──
  const catalogId = searchParams.get('catalogId') ?? '';
  const namespace = searchParams.get('namespace') ?? '';
  const table = searchParams.get('table') ?? '';
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '0'));

  const hasFilters = !!(catalogId || namespace || table || status || from || to);

  /** Patch the URL params. Any filter change (i.e. not `page`) resets pagination to page 0. */
  function patch(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next, { replace: true });
  }

  // ── Filter option sources ──
  const { data: catalogs } = useQuery({ queryKey: ['catalogs'], queryFn: catalogApi.list });
  const { data: namespaces } = useQuery({
    queryKey: ['namespaces', catalogId],
    queryFn: () => namespaceApi.list(Number(catalogId)),
    enabled: !!catalogId,
  });
  const { data: tables } = useQuery({
    queryKey: ['tables', catalogId, namespace],
    queryFn: () => namespaceApi.listTables(Number(catalogId), namespace),
    enabled: !!catalogId && !!namespace,
  });

  // ── Paginated, filtered results ──
  const queryParams: ExecutionSearchParams = {
    catalogId: catalogId ? Number(catalogId) : undefined,
    namespace: namespace || undefined,
    table: table || undefined,
    status: status || undefined,
    from: dayToInstant(from, 'start'),
    to: dayToInstant(to, 'end'),
    page,
    size: PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['executions-search', queryParams],
    queryFn: () => executionApi.search(queryParams),
    placeholderData: keepPreviousData,
  });

  const executions = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executions</h1>
        <p className="text-muted-foreground">Maintenance execution history</p>
      </div>

      {/* ── Filters ── */}
      <Card className="glass shadow-card">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Catalog</Label>
              <Select
                value={catalogId || ALL}
                onValueChange={(v) =>
                  patch({ catalogId: v === ALL ? undefined : v, namespace: undefined, table: undefined })
                }
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="All catalogs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All catalogs</SelectItem>
                  {catalogs?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Schema</Label>
              <Select
                value={namespace || ALL}
                onValueChange={(v) => patch({ namespace: v === ALL ? undefined : v, table: undefined })}
                disabled={!catalogId}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="All schemas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All schemas</SelectItem>
                  {namespaces?.map((n) => <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Table</Label>
              <Select
                value={table || ALL}
                onValueChange={(v) => patch({ table: v === ALL ? undefined : v })}
                disabled={!namespace}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="All tables" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tables</SelectItem>
                  {tables?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status || ALL}
                onValueChange={(v) => patch({ status: v === ALL ? undefined : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} max={to || undefined} onChange={(e) => patch({ from: e.target.value || undefined })} />
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} min={from || undefined} onChange={(e) => patch({ to: e.target.value || undefined })} />
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>
                <X className="mr-1 h-4 w-4" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Results ── */}
      <Card className="glass shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Executions</CardTitle>
          <span className="text-sm text-muted-foreground">
            {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : '0 results'}
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-2" />
              <p>No executions{hasFilters ? ' match these filters' : ' yet'}</p>
            </div>
          ) : (
            <>
              <UiTable className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Catalog</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono">{exec.id}</TableCell>
                      <TableCell>{exec.catalogName}</TableCell>
                      <TableCell className="font-medium">{exec.namespace}.{exec.tableName}</TableCell>
                      <TableCell><Badge variant="outline">{exec.actionType}</Badge></TableCell>
                      <TableCell><StatusBadge status={exec.status} /></TableCell>
                      <TableCell className="text-sm">{new Date(exec.startedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {exec.finishedAt
                          ? `${((new Date(exec.finishedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(1)}s`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-xs truncate">
                        {exec.errorMessage ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </UiTable>

              {/* ── Pagination ── */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 0}
                    onClick={() => patch({ page: String(page - 1) })}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => patch({ page: String(page + 1) })}
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
