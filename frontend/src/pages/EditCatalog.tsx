import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { CatalogForm } from '@/components/catalog/CatalogForm';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function EditCatalog() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { catalogId } = useParams();
  const id = Number(catalogId);

  const { data: catalog, isLoading, isError } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => catalogApi.get(id),
    enabled: !isNaN(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof catalogApi.update>[1]) => catalogApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', id] });
      toast.success('Catalog updated');
      navigate('/catalogs');
    },
    onError: (err: Error) => toast.error(`Failed to update catalog: ${err.message}`),
  });

  return (
    <div className="mx-auto max-w-2xl w-full space-y-6">
      <Link
        to="/catalogs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Catalogs
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Catalog</h1>
        <p className="text-muted-foreground">
          {catalog ? catalog.name : 'Update this catalog connection'}
        </p>
      </div>

      <Card className="glass shadow-card">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : isError || !catalog ? (
            <p className="py-16 text-center text-sm text-red-400">Catalog not found.</p>
          ) : (
            <CatalogForm
              mode="edit"
              initial={catalog}
              pending={updateMutation.isPending}
              onSubmit={(req) => updateMutation.mutate(req)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
