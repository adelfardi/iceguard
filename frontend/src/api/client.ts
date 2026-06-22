import axios from 'axios';
import type {
  AlertEventResponse,
  AlertRuleResponse,
  CatalogConfig,
  ConnectionTestResult,
  CreateAlertRuleRequest,
  CreateCatalogRequest,
  CreatePipelineRequest,
  CreateTableRequest,
  DataSampleResponse,
  ExecutionInfo,
  ExecutionSearchParams,
  PagedResponse,
  MaintenanceRequest,
  NamespaceInfo,
  PipelineResponse,
  PipelineRunResponse,
  RenameTableRequest,
  SaveSmtpConfigRequest,
  SaveStorageHealthThresholdsRequest,
  SaveTableOverviewThresholdsRequest,
  TableOverviewThresholds,
  SchemaUpdateRequest,
  PartitionSpecUpdateRequest,
  SparkClusterConfig,
  SparkClusterRequest,
  SmtpConfigResponse,
  StorageHealthThresholds,
  SnapshotInfo,
  TableDetail,
  TableStatistics,
  StorageOverview,
  StorageFiles,
  PartitionPage,
  SchemaHistory,
  SnapshotDiff,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/** Extract the backend's error message ({ message } body) instead of axios' generic
 *  "Request failed with status code 5xx". Falls back to the raw error message. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export const catalogApi = {
  list: () => api.get<CatalogConfig[]>('/catalogs').then((r) => r.data),
  get: (id: number) => api.get<CatalogConfig>(`/catalogs/${id}`).then((r) => r.data),
  create: (data: CreateCatalogRequest) =>
    api.post<CatalogConfig>('/catalogs', data).then((r) => r.data),
  update: (id: number, data: CreateCatalogRequest) =>
    api.put<CatalogConfig>(`/catalogs/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/catalogs/${id}`),
  setTags: (id: number, tags: string[]) =>
    api.put<CatalogConfig>(`/catalogs/${id}/tags`, { tags }).then((r) => r.data),
  testConnection: (id: number) =>
    api.post<ConnectionTestResult>(`/catalogs/${id}/test-connection`).then((r) => r.data),
};

export const sparkClusterApi = {
  list: () => api.get<SparkClusterConfig[]>('/spark-clusters').then((r) => r.data),
  get: (id: number) => api.get<SparkClusterConfig>(`/spark-clusters/${id}`).then((r) => r.data),
  create: (data: SparkClusterRequest) =>
    api.post<SparkClusterConfig>('/spark-clusters', data).then((r) => r.data),
  update: (id: number, data: SparkClusterRequest) =>
    api.put<SparkClusterConfig>(`/spark-clusters/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/spark-clusters/${id}`),
};

export const namespaceApi = {
  list: (catalogId: number) =>
    api.get<NamespaceInfo[]>(`/catalogs/${catalogId}/namespaces`).then((r) => r.data),
  listTables: (catalogId: number, namespace: string) =>
    api
      .get<string[]>(`/catalogs/${catalogId}/namespaces/${namespace}/tables`)
      .then((r) => r.data),
  create: (catalogId: number, data: { namespace: string; properties?: Record<string, string> }) =>
    api.post(`/catalogs/${catalogId}/namespaces`, data),
};

export const tableApi = {
  get: (catalogId: number, namespace: string, table: string) =>
    api
      .get<TableDetail>(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}`)
      .then((r) => r.data),
  create: (catalogId: number, namespace: string, data: CreateTableRequest) =>
    api.post(`/catalogs/${catalogId}/namespaces/${namespace}/tables`, data),
  drop: (catalogId: number, namespace: string, table: string, purge = false) =>
    api.delete(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}?purge=${purge}`),
  updateSchema: (
    catalogId: number,
    namespace: string,
    table: string,
    data: SchemaUpdateRequest,
  ) =>
    api.put(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/schema`, data),
  updatePartitionSpec: (
    catalogId: number,
    namespace: string,
    table: string,
    data: PartitionSpecUpdateRequest,
  ) =>
    api.put(
      `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/partition-spec`,
      data,
    ),
  getProperties: (catalogId: number, namespace: string, table: string) =>
    api
      .get<Record<string, string>>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/properties`,
      )
      .then((r) => r.data),
  updateProperties: (
    catalogId: number,
    namespace: string,
    table: string,
    set: Record<string, string>,
    remove: string[],
  ) =>
    api.put(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/properties`, {
      set,
      remove,
    }),
  listSnapshots: (catalogId: number, namespace: string, table: string) =>
    api
      .get<SnapshotInfo[]>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/snapshots`,
      )
      .then((r) => r.data),
  getStatistics: (catalogId: number, namespace: string, table: string) =>
    api
      .get<TableStatistics>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/statistics`,
      )
      .then((r) => r.data),
  rename: (catalogId: number, namespace: string, table: string, data: RenameTableRequest) =>
    api.post(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rename`, data),
  sampleData: (catalogId: number, namespace: string, table: string, limit = 100) =>
    api
      .get<DataSampleResponse>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/sample?limit=${limit}`,
      )
      .then((r) => r.data),
  getSchemaHistory: (catalogId: number, namespace: string, table: string) =>
    api
      .get<SchemaHistory>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/schema-history`,
      )
      .then((r) => r.data),
  compareSnapshots: (catalogId: number, namespace: string, table: string, from: string, to: string) =>
    api
      .get<SnapshotDiff>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/snapshot-diff`,
        { params: { from, to } },
      )
      .then((r) => r.data),
  getStorage: (catalogId: number, namespace: string, table: string) =>
    api
      .get<StorageOverview>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/storage`,
      )
      .then((r) => r.data),
  getStoragePartitions: (
    catalogId: number,
    namespace: string,
    table: string,
    params: { offset: number; limit: number; sort: string; dir: string; search?: string },
  ) =>
    api
      .get<PartitionPage>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/storage/partitions`,
        { params: { ...params, search: params.search || undefined } },
      )
      .then((r) => r.data),
  getStorageFiles: (catalogId: number, namespace: string, table: string, partition: string | null, limit = 500) =>
    api
      .get<StorageFiles>(
        `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/storage/files`,
        { params: { partition: partition ?? undefined, limit } },
      )
      .then((r) => r.data),
};

export const maintenanceApi = {
  expireSnapshots: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/expire-snapshots`,
        data,
      )
      .then((r) => r.data),
  rollback: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rollback`,
        data,
      )
      .then((r) => r.data),
  rewriteDataFiles: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rewrite-data-files`,
        data,
      )
      .then((r) => r.data),
  rewriteManifests: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rewrite-manifests`,
        data,
      )
      .then((r) => r.data),
  removeOrphanFiles: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/remove-orphan-files`,
        data,
      )
      .then((r) => r.data),
  rewritePositionDeleteFiles: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rewrite-position-delete-files`,
        data,
      )
      .then((r) => r.data),
  rewriteEqualityDeleteFiles: (
    catalogId: number,
    namespace: string,
    table: string,
    data: MaintenanceRequest,
  ) =>
    api
      .post<ExecutionInfo>(
        `/maintenance/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/rewrite-equality-delete-files`,
        data,
      )
      .then((r) => r.data),
};

export const executionApi = {
  list: (limit = 50) =>
    api.get<ExecutionInfo[]>(`/maintenance/executions?limit=${limit}`).then((r) => r.data),
  get: (id: number) => api.get<ExecutionInfo>(`/maintenance/executions/${id}`).then((r) => r.data),
  search: (params: ExecutionSearchParams) => {
    // Drop undefined/empty values so they don't end up as "?status=" in the query string.
    const query = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    return api
      .get<PagedResponse<ExecutionInfo>>('/maintenance/executions/search', { params: query })
      .then((r) => r.data);
  },
};

export const smtpApi = {
  get: () => api.get<SmtpConfigResponse | null>('/settings/smtp').then((r) => r.data || null),
  save: (data: SaveSmtpConfigRequest) =>
    api.post<SmtpConfigResponse>('/settings/smtp', data).then((r) => r.data),
  test: () =>
    api.post<{ success: boolean; message: string }>('/settings/smtp/test').then((r) => r.data),
};

export const storageHealthApi = {
  get: () =>
    api.get<StorageHealthThresholds>('/settings/storage-health-thresholds').then((r) => r.data),
  save: (data: SaveStorageHealthThresholdsRequest) =>
    api.put<StorageHealthThresholds>('/settings/storage-health-thresholds', data).then((r) => r.data),
};

export const tableOverviewThresholdApi = {
  get: (catalogId: number, namespace: string, table: string) =>
    api
      .get<TableOverviewThresholds>(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/overview-thresholds`)
      .then((r) => r.data),
  save: (catalogId: number, namespace: string, table: string, data: SaveTableOverviewThresholdsRequest) =>
    api
      .put<TableOverviewThresholds>(`/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}/overview-thresholds`, data)
      .then((r) => r.data),
};

export const alertApi = {
  listRules: () => api.get<AlertRuleResponse[]>('/alerts/rules').then((r) => r.data),
  getRule: (id: number) => api.get<AlertRuleResponse>(`/alerts/rules/${id}`).then((r) => r.data),
  createRule: (data: CreateAlertRuleRequest) =>
    api.post<AlertRuleResponse>('/alerts/rules', data).then((r) => r.data),
  updateRule: (id: number, data: CreateAlertRuleRequest) =>
    api.put<AlertRuleResponse>(`/alerts/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: number) => api.delete(`/alerts/rules/${id}`),
  toggleRule: (id: number, enabled: boolean) =>
    api.put<AlertRuleResponse>(`/alerts/rules/${id}/toggle?enabled=${enabled}`).then((r) => r.data),
  listEvents: (limit?: number) =>
    api.get<AlertEventResponse[]>(`/alerts/events?limit=${limit ?? 50}`).then((r) => r.data),
  eventsByRule: (ruleId: number) =>
    api.get<AlertEventResponse[]>(`/alerts/events/rule/${ruleId}`).then((r) => r.data),
  acknowledge: (id: number) =>
    api.put<AlertEventResponse>(`/alerts/events/${id}/acknowledge`).then((r) => r.data),
};

export const pipelineApi = {
  list: () => api.get<PipelineResponse[]>('/pipelines').then((r) => r.data),
  get: (id: number) => api.get<PipelineResponse>(`/pipelines/${id}`).then((r) => r.data),
  create: (data: CreatePipelineRequest) =>
    api.post<PipelineResponse>('/pipelines', data).then((r) => r.data),
  update: (id: number, data: CreatePipelineRequest) =>
    api.put<PipelineResponse>(`/pipelines/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/pipelines/${id}`),
  toggle: (id: number, enabled: boolean) =>
    api.put<PipelineResponse>(`/pipelines/${id}/toggle?enabled=${enabled}`).then((r) => r.data),
  trigger: (id: number) =>
    api.post<PipelineRunResponse>(`/pipelines/${id}/trigger`).then((r) => r.data),
  listRuns: (id: number) =>
    api.get<PipelineRunResponse[]>(`/pipelines/${id}/runs`).then((r) => r.data),
  recentRuns: (limit = 20) =>
    api.get<PipelineRunResponse[]>(`/pipelines/runs/recent?limit=${limit}`).then((r) => r.data),
  getRun: (runId: number) =>
    api.get<PipelineRunResponse>(`/pipelines/runs/${runId}`).then((r) => r.data),
};
