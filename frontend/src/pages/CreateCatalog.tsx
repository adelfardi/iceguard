import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { catalogApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CatalogForm } from '@/components/catalog/CatalogForm';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const FORM_ID = 'create-catalog-form';

export function CreateCatalog() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: catalogApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast.success('Catalog created successfully');
      navigate(`/catalogs/${created.id}`);
    },
    onError: (err: Error) => toast.error(`Failed to create catalog: ${err.message}`),
  });

  return (
    <div className="mx-auto max-w-2xl w-full space-y-6">
      <Link
        to="/catalogs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Catalogs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Catalog</h1>
          <p className="text-muted-foreground">
            Connect a new Iceberg REST, Nessie, or Polaris catalog
          </p>
        </div>
        <Button
          type="submit"
          form={FORM_ID}
          disabled={createMutation.isPending}
          className="gradient-primary text-white border-0 hover:opacity-90 shrink-0"
        >
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>

      <Card className="glass shadow-card">
        <CardContent className="pt-6">
          <CatalogForm
            id={FORM_ID}
            hideSubmit
            mode="create"
            pending={createMutation.isPending}
            onSubmit={(req) => createMutation.mutate(req)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
