import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { catalogApi, namespaceApi, tableApi } from '@/api/client';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen, Table2, Plus, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const ICEBERG_TYPES = [
  'string',
  'long',
  'int',
  'double',
  'float',
  'boolean',
  'date',
  'timestamp',
  'timestamptz',
  'decimal',
  'binary',
  'uuid',
] as const;

interface ColumnDef {
  name: string;
  type: string;
  required: boolean;
  doc: string;
}

export function CatalogDetail() {
  const { catalogId } = useParams<{ catalogId: string }>();
  const id = Number(catalogId);
  const [expandedNs, setExpandedNs] = useState<string | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => catalogApi.get(id),
  });

  const { data: namespaces, isLoading } = useQuery({
    queryKey: ['namespaces', id],
    queryFn: () => namespaceApi.list(id),
  });

  const queryClient = useQueryClient();
  const [nsDialogOpen, setNsDialogOpen] = useState(false);
  const createNsMutation = useMutation({
    mutationFn: (namespace: string) => namespaceApi.create(id, { namespace }),
    onSuccess: () => {
      toast.success('Namespace created');
      queryClient.invalidateQueries({ queryKey: ['namespaces', id] });
      queryClient.invalidateQueries({ queryKey: ['namespaces'] });
      setNsDialogOpen(false);
    },
    onError: (err: Error) => toast.error(`Failed to create namespace: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{catalog?.name ?? 'Catalog'}</h1>
        <p className="text-muted-foreground">{catalog?.uri}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Namespaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{namespaces?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auth Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{catalog?.authType}</Badge>
          </CardContent>
        </Card>
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground truncate">
              {catalog?.warehouse || 'Not set'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Namespaces</CardTitle>
          <Dialog open={nsDialogOpen} onOpenChange={setNsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> New Namespace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Namespace</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (new FormData(e.currentTarget).get('ns') as string).trim();
                  if (name) createNsMutation.mutate(name);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="ns">Name</Label>
                  <Input id="ns" name="ns" placeholder="analytics  ·  team.subteam (nested)" required autoFocus />
                  <p className="text-xs text-muted-foreground">Use dots for nested namespaces (e.g. <code>team.reporting</code>).</p>
                </div>
                <Button type="submit" disabled={createNsMutation.isPending}>
                  {createNsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : namespaces?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="mx-auto h-8 w-8 mb-2" />
              <p>No namespaces found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {namespaces?.map((ns) => (
                <NamespaceItem
                  key={ns.name}
                  catalogId={id}
                  namespace={ns.name}
                  expanded={expandedNs === ns.name}
                  onToggle={() => setExpandedNs(expandedNs === ns.name ? null : ns.name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NamespaceItem({
  catalogId,
  namespace,
  expanded,
  onToggle,
}: {
  catalogId: number;
  namespace: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables', catalogId, namespace],
    queryFn: () => namespaceApi.listTables(catalogId, namespace),
    enabled: expanded,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; columns: ColumnDef[] }) =>
      tableApi.create(catalogId, namespace, {
        name: data.name,
        columns: data.columns.map((c) => ({
          name: c.name,
          type: c.type,
          required: c.required,
          doc: c.doc || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success('Table created successfully');
      queryClient.invalidateQueries({ queryKey: ['tables', catalogId, namespace] });
      setCreateDialogOpen(false);
    },
    onError: (err: Error) => toast.error(`Failed to create table: ${err.message}`),
  });

  return (
    <div className="rounded-lg border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 hover:bg-accent transition-all duration-150 rounded-lg"
      >
        <FolderOpen className="h-4 w-4 text-yellow-500" />
        <span className="font-medium">{namespace}</span>
        {expanded && tables && (
          <Badge variant="secondary" className="ml-auto">
            {tables.length} table(s)
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="border-t px-3 pb-3">
          <div className="flex justify-end pt-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> Create Table
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Table in {namespace}</DialogTitle>
                </DialogHeader>
                <CreateTableForm
                  isPending={createMutation.isPending}
                  onSubmit={(data) => createMutation.mutate(data)}
                />
              </DialogContent>
            </Dialog>
          </div>
          {isLoading ? (
            <div className="py-2 space-y-1">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : tables?.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tables</p>
          ) : (
            <div className="space-y-1 pt-2">
              {tables?.map((t) => (
                <Link
                  key={t}
                  to={`/catalogs/${catalogId}/namespaces/${namespace}/tables/${t}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-all duration-150"
                >
                  <Table2 className="h-4 w-4 text-blue-500" />
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateTableForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (data: { name: string; columns: ColumnDef[] }) => void;
}) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: '', type: 'string', required: false, doc: '' },
  ]);

  const addColumn = () =>
    setColumns([...columns, { name: '', type: 'string', required: false, doc: '' }]);

  const removeColumn = (idx: number) => setColumns(columns.filter((_, i) => i !== idx));

  const updateColumn = (idx: number, field: keyof ColumnDef, value: string | boolean) =>
    setColumns(columns.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    const validCols = columns.filter((c) => c.name.trim());
    if (validCols.length === 0) {
      toast.error('At least one column with a name is required');
      return;
    }
    onSubmit({ name: tableName.trim(), columns: validCols });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Table Name</Label>
        <Input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="my_table"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Columns</Label>
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <Plus className="mr-1 h-3 w-3" /> Add Column
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {columns.map((col, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="Column name"
                  value={col.name}
                  onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                />
              </div>
              <div className="w-32">
                <Select
                  value={col.type}
                  onValueChange={(v) => updateColumn(idx, 'type', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICEBERG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-1 text-xs pt-2 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={col.required}
                  onChange={(e) => updateColumn(idx, 'required', e.target.checked)}
                  className="rounded"
                />
                Req
              </label>
              <div className="w-24">
                <Input
                  placeholder="Doc"
                  value={col.doc}
                  onChange={(e) => updateColumn(idx, 'doc', e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeColumn(idx)}
                disabled={columns.length === 1}
                className="mt-0.5"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Table
      </Button>
    </form>
  );
}
