export type CatalogType = 'rest' | 'nessie' | 'polaris';

export interface CatalogConfig {
  id: number;
  name: string;
  uri: string;
  warehouse: string | null;
  properties: Record<string, string>;
  authType: 'NONE' | 'BEARER' | 'OAUTH2' | 'BASIC';
  createdAt: string;
  updatedAt: string;
}

export function guessCatalogType(catalog: CatalogConfig): CatalogType {
  const lower = (catalog.name + catalog.uri).toLowerCase();
  if (lower.includes('nessie')) return 'nessie';
  if (lower.includes('polaris')) return 'polaris';
  return 'rest';
}

export const CATALOG_TYPE_META: Record<CatalogType, { label: string; color: string; description: string }> = {
  rest: { label: 'REST Catalog', color: 'text-blue-500', description: 'Apache Iceberg REST Catalog' },
  nessie: { label: 'Nessie', color: 'text-green-500', description: 'Project Nessie (Git-like versioning)' },
  polaris: { label: 'Polaris', color: 'text-purple-500', description: 'Apache Polaris (catalog-as-a-service)' },
};

export interface CreateCatalogRequest {
  name: string;
  uri: string;
  warehouse?: string;
  properties?: Record<string, string>;
  authType?: 'NONE' | 'BEARER' | 'OAUTH2' | 'BASIC';
  credentials?: Record<string, string>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  namespaceCount: number;
}

export interface NamespaceInfo {
  name: string;
  properties: Record<string, string>;
}

export interface TableDetail {
  namespace: string;
  name: string;
  schema: SchemaInfo;
  partitionSpec: PartitionFieldInfo[];
  properties: Record<string, string>;
  location: string;
  currentSnapshotId: string;
  schemaId: number;
  formatVersion: number;
}

export interface SchemaInfo {
  schemaId: number;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  id: number;
  name: string;
  type: string;
  required: boolean;
  doc: string | null;
}

export interface PartitionFieldInfo {
  sourceColumn: string;
  sourceId: number;
  transform: string;
  name: string;
}

export interface StorageOverview {
  namespace: string;
  tableName: string;
  partitioned: boolean;
  partitionFields: string[];
  currentSnapshotId: string;
  totalDataFiles: number;
  totalDeleteFiles: number;
  positionDeleteFiles: number;
  equalityDeleteFiles: number;
  totalSizeBytes: number;
  totalRecords: number;
  minFileSizeBytes: number;
  maxFileSizeBytes: number;
  avgFileSizeBytes: number;
  targetFileSizeBytes: number;
  partitionCount: number;
  maxPartitionSizeBytes: number;
  smallFileCount: number;
  fileSizeHistogram: FileSizeBucket[];
}

export interface PartitionPage {
  total: number;
  offset: number;
  limit: number;
  partitions: PartitionStorage[];
}

export interface FileSizeBucket {
  label: string;
  count: number;
  totalBytes: number;
}

export interface PartitionStorage {
  path: string;
  values: { field: string; value: string }[];
  specId: number;
  dataFileCount: number;
  deleteFileCount: number;
  positionDeleteFiles: number;
  equalityDeleteFiles: number;
  totalSizeBytes: number;
  minFileSizeBytes: number;
  maxFileSizeBytes: number;
  avgFileSizeBytes: number;
  recordCount: number;
}

export interface StorageFiles {
  partition: string | null;
  returned: number;
  truncated: boolean;
  files: StorageFileEntry[];
}

export interface StorageFileEntry {
  path: string;
  content: 'DATA' | 'POSITION_DELETES' | 'EQUALITY_DELETES';
  sizeBytes: number;
  recordCount: number;
  specId: number;
}

export interface ColumnRef {
  id: number;
  name: string;
  type: string;
  required: boolean;
}

export interface ColumnChange {
  id: number;
  name: string;
  kind: string;
  detail: string;
}

export interface SchemaDiff {
  fromSchemaId: number | null;
  toSchemaId: number | null;
  added: ColumnRef[];
  dropped: ColumnRef[];
  modified: ColumnChange[];
  unchanged: number;
}

export interface SchemaVersion {
  schemaId: number;
  snapshotId: string | null;
  timestamp: string | null;
  columnCount: number;
  columns: ColumnRef[];
  diff: SchemaDiff | null;
  current: boolean;
}

export interface SchemaHistory {
  namespace: string;
  tableName: string;
  currentSchemaId: number;
  versions: SchemaVersion[];
}

export interface SnapshotBrief {
  snapshotId: string;
  timestamp: string;
  operation: string;
  schemaId: number | null;
}

export interface MetricDelta {
  key: string;
  label: string;
  from: number;
  to: number;
  delta: number;
}

export interface SnapshotDiff {
  from: SnapshotBrief;
  to: SnapshotBrief;
  metrics: MetricDelta[];
  schemaDiff: SchemaDiff | null;
}

export interface SnapshotInfo {
  snapshotId: string;
  parentSnapshotId: string | null;
  timestamp: string;
  operation: string;
  summary: Record<string, string>;
  manifestList: string;
}

export interface TableStatistics {
  namespace: string;
  tableName: string;
  snapshotCount: number;
  totalDataFiles: number;
  totalDataSizeBytes: number;
  totalDeleteFiles: number;
  totalRecords: number;
  partitionFieldCount: number;
  schemaColumnCount: number;
  formatVersion: number;
  importantProperties: Record<string, string>;
}

export interface SchemaUpdateRequest {
  addColumns?: AddColumn[];
  dropColumns?: string[];
  renameColumns?: RenameColumn[];
  updateColumns?: UpdateColumn[];
}

export interface AddColumn {
  name: string;
  type: string;
  required: boolean;
  doc?: string;
  afterColumn?: string;
}

export interface RenameColumn {
  oldName: string;
  newName: string;
}

export interface UpdateColumn {
  name: string;
  newType?: string;
  doc?: string;
  required?: boolean;
}

export interface PartitionSpecUpdateRequest {
  addFields?: { sourceColumn: string; transform: string; name?: string }[];
  removeFields?: string[];
}

export interface MaintenanceRequest {
  olderThanMs?: number;
  retainLast?: number;
  snapshotId?: string;
  parameters?: Record<string, string>;
  /** "java" (default, analyse only) or "spark". */
  engine?: 'java' | 'spark';
  /** Spark cluster id; omit with engine="spark" for local Spark. */
  sparkClusterId?: number;
}

export interface SparkClusterConfig {
  id: number;
  name: string;
  masterUrl: string;
  description: string | null;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SparkClusterRequest {
  name: string;
  masterUrl: string;
  description?: string;
  properties?: Record<string, string>;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ExecutionSearchParams {
  catalogId?: number;
  namespace?: string;
  table?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface ExecutionInfo {
  id: number;
  scheduleId: number | null;
  catalogId: number;
  catalogName: string;
  namespace: string;
  tableName: string;
  actionType: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  finishedAt: string | null;
  result: Record<string, unknown>;
  errorMessage: string | null;
}

export interface ScheduleInfo {
  id: number;
  catalogId: number;
  catalogName: string;
  namespace: string;
  tableName: string;
  actionType: string;
  cronExpression: string;
  parameters: Record<string, string>;
  enabled: boolean;
  nextRun: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  catalogId: number;
  namespace?: string;
  tableName?: string;
  actionType: string;
  cronExpression: string;
  parameters?: Record<string, string>;
  enabled: boolean;
}

export interface CreateTableRequest {
  name: string;
  columns: { name: string; type: string; required: boolean; doc?: string }[];
  partitionFields?: { sourceColumn: string; transform: string }[];
  properties?: Record<string, string>;
}

export interface DataSampleResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  hasMore: boolean;
}

export interface RenameTableRequest {
  newName: string;
}

// ── Pipeline types ──

export interface PipelineResponse {
  id: number;
  name: string;
  description: string | null;
  catalogId: number;
  catalogName: string;
  namespace: string;
  tableName: string;
  cronExpression: string | null;
  enabled: boolean;
  tasks: PipelineTaskResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineTaskResponse {
  id: number;
  orderIndex: number;
  name: string;
  actionType: string;
  parameters: Record<string, string>;
}

export interface PipelineRunResponse {
  id: number;
  pipelineId: number;
  pipelineName: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  taskRuns: PipelineTaskRunResponse[];
}

export interface PipelineTaskRunResponse {
  id: number;
  taskId: number;
  taskName: string;
  actionType: string;
  orderIndex: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string | null;
  finishedAt: string | null;
  result: Record<string, unknown>;
  errorMessage: string | null;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  catalogId: number;
  namespace: string;
  tableName: string;
  cronExpression?: string;
  enabled: boolean;
  tasks: { name: string; actionType: string; parameters?: Record<string, string> }[];
}

// ── SMTP types ──

export interface SmtpConfigResponse {
  id: number | null;
  host: string;
  port: number;
  username: string;
  fromAddress: string;
  tls: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

export interface SaveSmtpConfigRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  tls: boolean;
  enabled: boolean;
}

export interface StorageHealthThresholds {
  avgVsTargetWarnPercent: number;
  avgVsTargetBadPercent: number;
  smallFileSizeKb: number;
  smallFilesWarnPercent: number;
  smallFilesBadPercent: number;
  deleteRatioWarnPercent: number;
  deleteRatioBadPercent: number;
  compactionTargetRatioPercent: number;
  avgVsTargetEnabled: boolean;
  smallFilesEnabled: boolean;
  deleteRatioEnabled: boolean;
  compactionEnabled: boolean;
  updatedAt: string | null;
}

export type SaveStorageHealthThresholdsRequest = Omit<StorageHealthThresholds, 'updatedAt'>;

// ── Alert types ──

export interface AlertRuleResponse {
  id: number;
  name: string;
  catalogId: number;
  catalogName: string;
  namespace: string;
  tableName: string;
  metric: string;
  operator: string;
  threshold: number;
  checkIntervalMinutes: number;
  emails: string[];
  enabled: boolean;
  lastCheckedAt: string | null;
  lastValue: number | null;
  lastStatus: string | null;
  createdAt: string;
}

export interface CreateAlertRuleRequest {
  name: string;
  catalogId: number;
  namespace: string;
  tableName: string;
  metric: string;
  operator: string;
  threshold: number;
  checkIntervalMinutes: number;
  emails: string[];
  enabled: boolean;
}

export interface AlertEventResponse {
  id: number;
  ruleId: number;
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  operator: string;
  tableRef: string;
  status: string;
  notified: boolean;
  triggeredAt: string;
  resolvedAt: string | null;
}
