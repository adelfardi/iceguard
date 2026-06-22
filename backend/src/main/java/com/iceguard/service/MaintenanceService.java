package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.dto.request.MaintenanceRequest;
import com.iceguard.dto.response.ExecutionResponse;
import com.iceguard.dto.response.PagedResponse;
import com.iceguard.executor.MaintenanceExecutor;
import com.iceguard.executor.MaintenanceExecutor.ExecutorContext;
import com.iceguard.executor.MaintenanceExecutor.MaintenanceResult;
import com.iceguard.executor.SparkEngine;
import com.iceguard.executor.SparkMaintenanceExecutor;
import com.iceguard.model.CatalogConfig;
import com.iceguard.model.ExecutionHistory;
import com.iceguard.model.ExecutionHistory.ExecutionStatus;
import com.iceguard.model.SparkClusterConfig;
import com.iceguard.repository.ExecutionHistoryRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class MaintenanceService {

    @Inject
    MaintenanceExecutor executor;

    @Inject
    @SparkEngine
    MaintenanceExecutor sparkExecutor;

    @Inject
    SparkClusterService sparkClusterService;

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    @Inject
    CatalogService catalogService;

    @Inject
    ExecutionHistoryRepository executionRepository;

    @Inject
    ObjectMapper objectMapper;

    @Transactional
    public ExecutionResponse expireSnapshots(Long catalogId, String namespace, String tableName,
                                             MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "EXPIRE_SNAPSHOTS");

        MaintenanceResult result = executor.expireSnapshots(ctx, request.olderThanMs(), request.retainLast());

        return completeExecution(history, result);
    }

    @Transactional
    public ExecutionResponse rollback(Long catalogId, String namespace, String tableName,
                                       MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        if (request.snapshotId() == null) {
            throw new IllegalArgumentException("snapshotId is required for rollback");
        }

        ExecutionHistory history = startExecution(config, namespace, tableName, "ROLLBACK");
        MaintenanceResult result = executor.rollbackToSnapshot(ctx, request.snapshotId());

        return completeExecution(history, result);
    }

    @Transactional
    public ExecutionResponse rewriteDataFiles(Long catalogId, String namespace, String tableName,
                                               MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "REWRITE_DATA_FILES");

        Map<String, String> baseOptions = request.parameters() != null ? request.parameters() : Map.of();
        MaintenanceResult result;

        if ("spark".equalsIgnoreCase(request.engine())) {
            Map<String, String> opts = buildSparkOptions(config, baseOptions, request.sparkClusterId());
            result = sparkExecutor.rewriteDataFiles(ctx, opts);
        } else {
            result = executor.rewriteDataFiles(ctx, baseOptions);
        }

        return completeExecution(history, result);
    }

    /**
     * Rewrite data files for pipeline tasks. Reads {@code engine} and optional
     * {@code sparkClusterId} from {@code params}; remaining entries are Iceberg options.
     */
    public MaintenanceResult rewriteDataFilesForPipeline(ExecutorContext ctx, CatalogConfig config,
                                                         Map<String, String> params) {
        Map<String, String> baseOptions = new LinkedHashMap<>(params);
        String engine = baseOptions.remove("engine");
        String sparkClusterIdStr = baseOptions.remove("sparkClusterId");

        if ("spark".equalsIgnoreCase(engine)) {
            Long sparkClusterId = null;
            if (sparkClusterIdStr != null && !sparkClusterIdStr.isBlank()) {
                sparkClusterId = Long.parseLong(sparkClusterIdStr);
            }
            return sparkExecutor.rewriteDataFiles(ctx, buildSparkOptions(config, baseOptions, sparkClusterId));
        }
        return executor.rewriteDataFiles(ctx, baseOptions);
    }

    /**
     * Compact position-delete files. This is a Spark-only action (delete-file rewriting needs a
     * compute engine), so it runs on Spark unless {@code engine="java"} is explicitly requested,
     * in which case it returns an error.
     */
    @Transactional
    public ExecutionResponse rewritePositionDeleteFiles(Long catalogId, String namespace, String tableName,
                                                        MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "REWRITE_POSITION_DELETE_FILES");

        Map<String, String> baseOptions = request.parameters() != null ? request.parameters() : Map.of();
        MaintenanceResult result;
        if ("java".equalsIgnoreCase(request.engine())) {
            result = MaintenanceResult.failure(
                    "rewrite_position_delete_files is not available with the Java engine "
                    + "(rewriting delete files needs Spark). Use engine=\"spark\".");
        } else {
            result = sparkExecutor.rewritePositionDeletes(
                    ctx, buildSparkOptions(config, baseOptions, request.sparkClusterId()));
        }

        return completeExecution(history, result);
    }

    /** Compact position-delete files for pipeline tasks (Spark engine; see {@link #rewritePositionDeleteFiles}). */
    public MaintenanceResult rewritePositionDeletesForPipeline(ExecutorContext ctx, CatalogConfig config,
                                                               Map<String, String> params) {
        Map<String, String> baseOptions = new LinkedHashMap<>(params);
        String engine = baseOptions.remove("engine");
        String sparkClusterIdStr = baseOptions.remove("sparkClusterId");
        if ("java".equalsIgnoreCase(engine)) {
            return MaintenanceResult.failure(
                    "rewrite_position_delete_files is not available with the Java engine — use engine=\"spark\".");
        }
        Long sparkClusterId = null;
        if (sparkClusterIdStr != null && !sparkClusterIdStr.isBlank()) {
            sparkClusterId = Long.parseLong(sparkClusterIdStr);
        }
        return sparkExecutor.rewritePositionDeletes(ctx, buildSparkOptions(config, baseOptions, sparkClusterId));
    }

    /**
     * Remove equality-delete files (Spark-only). Iceberg has no dedicated procedure, so this rewrites
     * the data files that carry the deletes (via {@code rewrite_data_files}); see the Spark executor.
     */
    @Transactional
    public ExecutionResponse rewriteEqualityDeleteFiles(Long catalogId, String namespace, String tableName,
                                                        MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "REWRITE_EQUALITY_DELETE_FILES");

        Map<String, String> baseOptions = request.parameters() != null ? request.parameters() : Map.of();
        MaintenanceResult result;
        if ("java".equalsIgnoreCase(request.engine())) {
            result = MaintenanceResult.failure(
                    "rewrite_equality_delete_files is not available with the Java engine "
                    + "(rewriting delete files needs Spark). Use engine=\"spark\".");
        } else {
            result = sparkExecutor.rewriteEqualityDeletes(
                    ctx, buildSparkOptions(config, baseOptions, request.sparkClusterId()));
        }

        return completeExecution(history, result);
    }

    /** Remove equality-delete files for pipeline tasks (Spark engine; see {@link #rewriteEqualityDeleteFiles}). */
    public MaintenanceResult rewriteEqualityDeletesForPipeline(ExecutorContext ctx, CatalogConfig config,
                                                               Map<String, String> params) {
        Map<String, String> baseOptions = new LinkedHashMap<>(params);
        String engine = baseOptions.remove("engine");
        String sparkClusterIdStr = baseOptions.remove("sparkClusterId");
        if ("java".equalsIgnoreCase(engine)) {
            return MaintenanceResult.failure(
                    "rewrite_equality_delete_files is not available with the Java engine — use engine=\"spark\".");
        }
        Long sparkClusterId = null;
        if (sparkClusterIdStr != null && !sparkClusterIdStr.isBlank()) {
            sparkClusterId = Long.parseLong(sparkClusterIdStr);
        }
        return sparkExecutor.rewriteEqualityDeletes(ctx, buildSparkOptions(config, baseOptions, sparkClusterId));
    }

    /** Assemble Iceberg rewrite options plus reserved Spark/catalog/S3 infrastructure keys. */
    private Map<String, String> buildSparkOptions(CatalogConfig config, Map<String, String> baseOptions,
                                                  Long sparkClusterId) {
        Map<String, String> opts = new LinkedHashMap<>(baseOptions);

        String master = "local[*]";
        if (sparkClusterId != null) {
            SparkClusterConfig cluster = sparkClusterService.findOrThrow(sparkClusterId);
            master = cluster.masterUrl;
            for (var e : parseJson(cluster.properties).entrySet()) {
                opts.put(SparkMaintenanceExecutor.OPT_CONF_PREFIX + e.getKey(), e.getValue());
            }
        }
        opts.put(SparkMaintenanceExecutor.OPT_MASTER, master);
        opts.put(SparkMaintenanceExecutor.OPT_CATALOG_URI, config.uri);
        if (config.warehouse != null && !config.warehouse.isBlank()) {
            opts.put(SparkMaintenanceExecutor.OPT_CATALOG_WAREHOUSE, config.warehouse);
        }

        // Forward any S3 settings stored on the catalog so Spark can reach the object store.
        // If absent, the REST catalog vends per-table FileIO credentials to the Spark client.
        Map<String, String> creds = parseJson(config.credentials);
        putIfPresent(opts, SparkMaintenanceExecutor.OPT_S3_ENDPOINT, creds.get("s3.endpoint"));
        putIfPresent(opts, SparkMaintenanceExecutor.OPT_S3_ACCESS_KEY, creds.get("s3.access-key-id"));
        putIfPresent(opts, SparkMaintenanceExecutor.OPT_S3_SECRET_KEY, creds.get("s3.secret-access-key"));
        putIfPresent(opts, SparkMaintenanceExecutor.OPT_S3_PATH_STYLE, creds.get("s3.path-style-access"));
        putIfPresent(opts, SparkMaintenanceExecutor.OPT_S3_REGION, creds.get("s3.region"));
        return opts;
    }

    private void putIfPresent(Map<String, String> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private Map<String, String> parseJson(String json) {
        if (json == null || json.isBlank() || "{}".equals(json)) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @Transactional
    public ExecutionResponse rewriteManifests(Long catalogId, String namespace, String tableName,
                                               MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "REWRITE_MANIFESTS");

        Map<String, String> options = request.parameters() != null ? request.parameters() : Map.of();
        MaintenanceResult result = executor.rewriteManifests(ctx, options);

        return completeExecution(history, result);
    }

    @Transactional
    public ExecutionResponse removeOrphanFiles(Long catalogId, String namespace, String tableName,
                                                MaintenanceRequest request) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        ExecutorContext ctx = buildContext(config, namespace, tableName);

        ExecutionHistory history = startExecution(config, namespace, tableName, "REMOVE_ORPHAN_FILES");

        Map<String, String> options = request.parameters() != null ? request.parameters() : Map.of();
        MaintenanceResult result = executor.removeOrphanFiles(ctx, options);

        return completeExecution(history, result);
    }

    public List<ExecutionResponse> listExecutions(int limit) {
        return executionRepository.findRecent(limit).stream()
                .map(this::toResponse)
                .toList();
    }

    public PagedResponse<ExecutionResponse> searchExecutions(Long catalogId, String namespace, String tableName,
                                                             ExecutionStatus status, Instant from, Instant to,
                                                             int page, int size) {
        var query = executionRepository.search(catalogId, namespace, tableName, status, from, to);
        long total = query.count();
        List<ExecutionResponse> items = query.page(page, size).list().stream()
                .map(this::toResponse)
                .toList();
        return new PagedResponse<>(items, total, page, size);
    }

    public ExecutionResponse getExecution(Long id) {
        ExecutionHistory history = executionRepository.findById(id);
        if (history == null) throw new IllegalArgumentException("Execution not found: " + id);
        return toResponse(history);
    }

    private ExecutorContext buildContext(CatalogConfig config, String namespace, String tableName) {
        Table table = catalogFactory.getOrCreate(config)
                .loadTable(TableIdentifier.of(Namespace.of(namespace), tableName));
        return new ExecutorContext(
                config.name, config.uri, config.warehouse,
                Map.of(), namespace, tableName, table
        );
    }

    private ExecutionHistory startExecution(CatalogConfig config, String namespace,
                                            String tableName, String actionType) {
        ExecutionHistory history = new ExecutionHistory();
        history.catalog = config;
        history.namespace = namespace;
        history.tableName = tableName;
        history.actionType = actionType;
        history.status = ExecutionStatus.RUNNING;
        history.startedAt = Instant.now();
        executionRepository.persist(history);
        return history;
    }

    private ExecutionResponse completeExecution(ExecutionHistory history, MaintenanceResult result) {
        history.finishedAt = Instant.now();
        history.status = result.success() ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        try {
            history.result = objectMapper.writeValueAsString(result.details());
        } catch (Exception e) {
            history.result = "{}";
        }
        if (!result.success()) {
            history.errorMessage = result.message();
        }
        return toResponse(history);
    }

    @SuppressWarnings("unchecked")
    private ExecutionResponse toResponse(ExecutionHistory h) {
        Map<String, Object> resultMap = Map.of();
        try {
            if (h.result != null) resultMap = objectMapper.readValue(h.result, Map.class);
        } catch (Exception ignored) {
        }
        return new ExecutionResponse(
                h.id, h.schedule != null ? h.schedule.id : null,
                h.catalog.id, h.catalog.name,
                h.namespace, h.tableName, h.actionType,
                h.status, h.startedAt, h.finishedAt,
                resultMap, h.errorMessage
        );
    }
}
