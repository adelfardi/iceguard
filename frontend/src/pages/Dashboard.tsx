import { useQuery, useQueries } from '@tanstack/react-query';
import { catalogApi, executionApi, namespaceApi, pipelineApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Activity, AlertTriangle, CheckCircle2, FolderOpen, GitBranch, ArrowRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatusBadge } from '@/components/ui/status-badge';

const COLORS = { emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', blue: '#3b82f6', gray: '#d1d5db' };

export function Dashboard() {
  const { data: catalogs, isLoading: loadingCatalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
  });
  const { data: executions, isLoading: loadingExecs } = useQuery({
    queryKey: ['executions'],
    queryFn: () => executionApi.list(20),
  });
  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: pipelineApi.list,
  });

  const successCount = executions?.filter((e) => e.status === 'SUCCESS').length ?? 0;
  const failedCount = executions?.filter((e) => e.status === 'FAILED').length ?? 0;
  const runningCount = executions?.filter((e) => e.status === 'RUNNING').length ?? 0;
  const totalExecs = executions?.length ?? 0;

  const execPie = [
    { name: 'Success', value: successCount, color: COLORS.emerald },
    { name: 'Failed', value: failedCount, color: COLORS.rose },
    { name: 'Running', value: runningCount, color: COLORS.blue },
    { name: 'Other', value: Math.max(0, totalExecs - successCount - failedCount - runningCount), color: COLORS.gray },
  ].filter((d) => d.value > 0);

  const failPie = [
    { name: 'Failed', value: failedCount, color: COLORS.rose },
    { name: 'OK', value: Math.max(1, totalExecs - failedCount), color: COLORS.gray },
  ];

  const successPie = [
    { name: 'Success', value: successCount, color: COLORS.emerald },
    { name: 'Other', value: Math.max(1, totalExecs - successCount), color: COLORS.gray },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Apache Iceberg table management overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Catalogs */}
        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catalogs</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Database className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingCatalogs ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{catalogs?.length ?? 0}</div>
            )}
            {pipelines && pipelines.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <GitBranch className="inline h-3 w-3 mr-0.5" />{pipelines.length} pipeline(s)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Recent Executions + mini pie */}
        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-accent">
              <Activity className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingExecs ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{totalExecs}</div>
                {totalExecs > 0 && (
                  <ResponsiveContainer width={48} height={48}>
                    <PieChart>
                      <Pie data={execPie} cx="50%" cy="50%" innerRadius={14} outerRadius={22} dataKey="value" strokeWidth={0}>
                        {execPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Failed + mini donut */}
        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-danger">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingExecs ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${failedCount > 0 ? 'text-destructive' : ''}`}>
                  {failedCount}
                </div>
                {totalExecs > 0 && (
                  <ResponsiveContainer width={48} height={48}>
                    <PieChart>
                      <Pie data={failPie} cx="50%" cy="50%" innerRadius={14} outerRadius={22} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        {failPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Success + mini bar */}
        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-success">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingExecs ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-emerald-400">{successCount}</div>
                {totalExecs > 0 && (
                  <ResponsiveContainer width={64} height={40}>
                    <BarChart data={[
                      { name: 'OK', v: successCount },
                      { name: 'Fail', v: failedCount },
                      { name: 'Other', v: Math.max(0, totalExecs - successCount - failedCount) },
                    ]}>
                      <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                        <Cell fill={COLORS.emerald} />
                        <Cell fill={COLORS.rose} />
                        <Cell fill={COLORS.gray} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Configured Catalogs</CardTitle>
            {(catalogs?.length ?? 0) > 0 && <ViewAllLink to="/catalogs" />}
          </CardHeader>
          <CardContent>
            {loadingCatalogs ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : catalogs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="mx-auto h-8 w-8 mb-2" />
                <p>No catalogs configured</p>
                <Link to="/catalogs" className="text-primary hover:underline text-sm">Add your first catalog</Link>
              </div>
            ) : (
              <CatalogCardList catalogIds={(catalogs ?? []).map((c) => c.id)} catalogs={catalogs ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="glass shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Recent Executions</CardTitle>
            {(executions?.length ?? 0) > 0 && <ViewAllLink to="/executions" />}
          </CardHeader>
          <CardContent>
            {loadingExecs ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : executions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-2" />
                <p>No executions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {executions?.slice(0, 8).map((exec) => (
                  <div key={exec.id} className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-accent transition-all duration-150">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{exec.namespace}.{exec.tableName}</p>
                      <p className="text-xs text-muted-foreground">{exec.actionType}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={exec.status} />
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {formatExecDuration(exec.startedAt, exec.finishedAt)}
                        <span className="opacity-50">·</span>
                        {formatExecTime(exec.startedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ViewAllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      View all <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function formatExecDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatExecTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CatalogCardList({ catalogIds, catalogs }: { catalogIds: number[]; catalogs: import('@/types').CatalogConfig[] }) {
  const nsQueries = useQueries({
    queries: catalogIds.map((id) => ({
      queryKey: ['namespaces', id],
      queryFn: () => namespaceApi.list(id),
      staleTime: 60_000,
    })),
  });

  return (
    <div className="space-y-2">
      {catalogs.map((cat, idx) => {
        const nsQuery = nsQueries[idx];
        const nsCount = nsQuery?.data?.length;
        return (
          <Link key={cat.id} to={`/catalogs/${cat.id}`} className="flex items-center justify-between rounded-lg p-3 hover:bg-accent transition-all duration-150">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{cat.uri}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {nsQuery?.isLoading ? <Skeleton className="h-5 w-12" /> : nsCount != null ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5" />{nsCount}
                </span>
              ) : null}
              <Badge variant="outline">{cat.authType}</Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
