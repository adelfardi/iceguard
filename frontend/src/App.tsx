import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Catalogs } from '@/pages/Catalogs';
import { CatalogDetail } from '@/pages/CatalogDetail';
import { TableDetail } from '@/pages/TableDetail';
import { Executions } from '@/pages/Executions';
import { Pipelines } from '@/pages/Pipelines';
import { PipelineDetail } from '@/pages/PipelineDetail';
import { SettingsPage } from '@/pages/SettingsPage';
import { Alerts } from '@/pages/Alerts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'catalogs', element: <Catalogs /> },
      { path: 'catalogs/:catalogId', element: <CatalogDetail /> },
      { path: 'catalogs/:catalogId/namespaces/:namespace/tables/:table', element: <TableDetail /> },
      { path: 'executions', element: <Executions /> },
      { path: 'pipelines', element: <Pipelines /> },
      { path: 'pipelines/:pipelineId', element: <PipelineDetail /> },
      { path: 'alerts', element: <Alerts /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
