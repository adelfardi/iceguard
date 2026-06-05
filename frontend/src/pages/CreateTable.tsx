import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, tableApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { CreateTableWizard, toCreateTableRequest } from '@/components/catalog/CreateTableWizard';
import type { TableWizardData } from '@/components/catalog/CreateTableWizard';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export function CreateTable() {
  const { catalogId, namespace } = useParams<{ catalogId: string; namespace: string }>();
  const id = Number(catalogId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => catalogApi.get(id),
    enabled: !isNaN(id),
  });

  const createMutation = useMutation({
    mutationFn: (data: TableWizardData) =>
      tableApi.create(id, namespace!, toCreateTableRequest(data)),
    onSuccess: (_data, variables) => {
      toast.success('Table created successfully');
      queryClient.invalidateQueries({ queryKey: ['tables', id, namespace] });
      navigate(`/catalogs/${id}/namespaces/${namespace}/tables/${variables.name}`);
    },
    onError: (err: Error) => toast.error(`Failed to create table: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl w-full space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full space-y-6">
      <Link
        to={`/catalogs/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to {catalog?.name ?? 'Catalog'}
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Table</h1>
        <p className="text-muted-foreground">
          {catalog?.name} · namespace <span className="font-mono">{namespace}</span>
        </p>
      </div>

      <Card className="glass shadow-card">
        <CardContent className="pt-6">
          <CreateTableWizard
            isPending={createMutation.isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
