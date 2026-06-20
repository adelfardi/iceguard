package com.iceguard.service;

import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.dto.request.CreateTableRequest;
import com.iceguard.dto.request.PartitionSpecUpdateRequest;
import com.iceguard.dto.request.SchemaUpdateRequest;
import com.iceguard.dto.response.*;
import com.iceguard.exception.CatalogOperationException;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.data.GenericRecord;
import org.apache.iceberg.data.IcebergGenerics;
import org.apache.iceberg.data.InternalRecordWrapper;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.data.parquet.GenericParquetWriter;
import org.apache.iceberg.io.CloseableIterable;
import org.apache.iceberg.io.DataWriter;
import org.apache.iceberg.io.FileIO;
import org.apache.iceberg.io.OutputFile;
import org.apache.iceberg.parquet.Parquet;
import org.apache.iceberg.rest.RESTCatalog;
import org.apache.iceberg.types.Type;
import org.apache.iceberg.types.Types;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@ApplicationScoped
public class TableService {

    private static final org.jboss.logging.Logger LOG = org.jboss.logging.Logger.getLogger(TableService.class);

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    @Inject
    CatalogService catalogService;

    @Inject
    NessieHistoryService nessieHistoryService;

    @Inject
    StorageHealthThresholdsService storageHealthThresholdsService;

    @Inject
    TableDataService dataService;

    @Inject
    TableLineageService lineageService;

    @Inject
    TableStorageService storageService;

    public List<NamespaceResponse> listNamespaces(Long catalogId) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            return catalog.listNamespaces().stream()
                    .map(ns -> {
                        Map<String, String> props = Map.of();
                        try {
                            props = catalog.loadNamespaceMetadata(ns);
                        } catch (Exception ignored) {
                        }
                        return new NamespaceResponse(ns.toString(), props);
                    })
                    .toList();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to list namespaces", e);
        }
    }

    public void createNamespace(Long catalogId, String namespace, Map<String, String> properties) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            Namespace ns = Namespace.of(namespace.split("\\."));
            // Use a mutable map: Iceberg's CreateNamespaceRequest builder calls
            // properties.containsKey(null) for validation, which throws on Map.of() (immutable).
            catalog.createNamespace(ns, new HashMap<>(properties != null ? properties : Map.of()));
        } catch (org.apache.iceberg.exceptions.AlreadyExistsException e) {
            throw new CatalogOperationException("Namespace already exists: " + namespace, e);
        } catch (Exception e) {
            LOG.error("createNamespace failed for " + namespace, e);
            throw new CatalogOperationException("Failed to create namespace " + namespace + ": "
                    + e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    public List<String> listTables(Long catalogId, String namespace) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            return catalog.listTables(Namespace.of(namespace)).stream()
                    .map(TableIdentifier::name)
                    .toList();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to list tables in " + namespace, e);
        }
    }

    public TableResponse getTable(Long catalogId, String namespace, String tableName) {
        Table table = loadTable(catalogId, namespace, tableName);
        return mapTableResponse(namespace, tableName, table);
    }

    public void createTable(Long catalogId, String namespace, CreateTableRequest request) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            Schema schema = buildSchema(request.columns());
            PartitionSpec spec = buildPartitionSpec(schema, request.partitionFields());

            catalog.buildTable(TableIdentifier.of(Namespace.of(namespace), request.name()), schema)
                    .withPartitionSpec(spec)
                    .withProperties(request.properties() != null ? request.properties() : Map.of())
                    .create();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to create table: " + e.getMessage(), e);
        }
    }

    public void dropTable(Long catalogId, String namespace, String tableName, boolean purge) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            catalog.dropTable(TableIdentifier.of(Namespace.of(namespace), tableName), purge);
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to drop table: " + e.getMessage(), e);
        }
    }

    public void updateSchema(Long catalogId, String namespace, String tableName, SchemaUpdateRequest request) {
        Table table = loadTable(catalogId, namespace, tableName);
        try {
            UpdateSchema update = table.updateSchema();

            if (request.addColumns() != null) {
                for (var col : request.addColumns()) {
                    Type type = Types.fromPrimitiveString(col.type());
                    if (col.afterColumn() != null) {
                        update.addColumn(null, col.name(), type, col.doc());
                        update.moveAfter(col.name(), col.afterColumn());
                    } else {
                        update.addColumn(null, col.name(), type, col.doc());
                    }
                    if (col.required()) {
                        update.requireColumn(col.name());
                    }
                }
            }

            if (request.dropColumns() != null) {
                for (String col : request.dropColumns()) {
                    update.deleteColumn(col);
                }
            }

            if (request.renameColumns() != null) {
                for (var rename : request.renameColumns()) {
                    update.renameColumn(rename.oldName(), rename.newName());
                }
            }

            if (request.updateColumns() != null) {
                for (var upd : request.updateColumns()) {
                    if (upd.newType() != null) {
                        update.updateColumn(upd.name(), Types.fromPrimitiveString(upd.newType()).asPrimitiveType());
                    }
                    if (upd.doc() != null) {
                        update.updateColumnDoc(upd.name(), upd.doc());
                    }
                    if (upd.required() != null) {
                        if (upd.required()) {
                            update.requireColumn(upd.name());
                        } else {
                            update.makeColumnOptional(upd.name());
                        }
                    }
                }
            }

            update.commit();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to update schema: " + e.getMessage(), e);
        }
    }

    public void updatePartitionSpec(Long catalogId, String namespace, String tableName,
                                    PartitionSpecUpdateRequest request) {
        Table table = loadTable(catalogId, namespace, tableName);
        try {
            org.apache.iceberg.UpdatePartitionSpec update = table.updateSpec();

            if (request.removeFields() != null) {
                for (String name : request.removeFields()) {
                    update.removeField(name);
                }
            }

            if (request.addFields() != null) {
                for (var pf : request.addFields()) {
                    org.apache.iceberg.expressions.Term term = buildTerm(pf.sourceColumn(), pf.transform());
                    if (pf.name() != null && !pf.name().isBlank()) {
                        update.addField(pf.name(), term);
                    } else {
                        update.addField(term);
                    }
                }
            }

            update.commit();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to update partition spec: " + e.getMessage(), e);
        }
    }

    private org.apache.iceberg.expressions.Term buildTerm(String column, String transform) {
        String t = transform == null ? "identity" : transform.toLowerCase();
        return switch (t) {
            case "identity" -> org.apache.iceberg.expressions.Expressions.ref(column);
            case "year" -> org.apache.iceberg.expressions.Expressions.year(column);
            case "month" -> org.apache.iceberg.expressions.Expressions.month(column);
            case "day" -> org.apache.iceberg.expressions.Expressions.day(column);
            case "hour" -> org.apache.iceberg.expressions.Expressions.hour(column);
            default -> {
                if (t.startsWith("bucket")) {
                    int n = Integer.parseInt(t.replaceAll("\\D", ""));
                    yield org.apache.iceberg.expressions.Expressions.bucket(column, n);
                } else if (t.startsWith("truncate")) {
                    int w = Integer.parseInt(t.replaceAll("\\D", ""));
                    yield org.apache.iceberg.expressions.Expressions.truncate(column, w);
                } else {
                    yield org.apache.iceberg.expressions.Expressions.ref(column);
                }
            }
        };
    }

    public Map<String, String> getProperties(Long catalogId, String namespace, String tableName) {
        Table table = loadTable(catalogId, namespace, tableName);
        return table.properties();
    }

    public void updateProperties(Long catalogId, String namespace, String tableName,
                                 Map<String, String> setProps, List<String> removeProps) {
        Table table = loadTable(catalogId, namespace, tableName);
        try {
            UpdateProperties update = table.updateProperties();
            if (setProps != null) {
                setProps.forEach(update::set);
            }
            if (removeProps != null) {
                removeProps.forEach(update::remove);
            }
            update.commit();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to update properties: " + e.getMessage(), e);
        }
    }

    public List<SnapshotResponse> listSnapshots(Long catalogId, String namespace, String tableName) {
        // Nessie exposes only the current Iceberg snapshot; reconstruct the full
        // history from its commit log so the client sees it transparently.
        CatalogConfig cfg = CatalogConfig.findById(catalogId);
        if (cfg != null && isNessie(cfg)) {
            try {
                return nessieSnapshots(cfg, namespace, tableName);
            } catch (Exception e) {
                // Commit log unavailable — fall back to the single Iceberg snapshot below.
            }
        }
        Table table = loadTable(catalogId, namespace, tableName);
        return StreamSupport.stream(table.snapshots().spliterator(), false)
                .map(s -> new SnapshotResponse(
                        s.snapshotId(),
                        s.parentId(),
                        Instant.ofEpochMilli(s.timestampMillis()),
                        s.operation(),
                        s.summary(),
                        s.manifestListLocation()
                ))
                .toList();
    }

    /** Driven by the stored vendor, not re-guessed from the name/URI. */
    private static boolean isNessie(CatalogConfig cfg) {
        return cfg.vendor == CatalogConfig.Vendor.NESSIE;
    }

    /** Map the Nessie commit log to the SnapshotResponse shape (newest-first). */
    private List<SnapshotResponse> nessieSnapshots(CatalogConfig cfg, String namespace, String tableName) {
        List<NessieCommitResponse> commits = nessieHistoryService.tableHistory(cfg.id, namespace, tableName);
        // Several Nessie commits can reference the same Iceberg snapshot id (metadata-only
        // changes). Keep one entry per distinct snapshot (newest commit wins) so ids are unique.
        List<NessieCommitResponse> distinct = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (NessieCommitResponse c : commits) {
            if (c.snapshotId() != null && seen.add(c.snapshotId())) distinct.add(c);
        }
        List<SnapshotResponse> out = new ArrayList<>(distinct.size());
        for (int i = 0; i < distinct.size(); i++) {
            NessieCommitResponse c = distinct.get(i);
            Long parent = (i + 1 < distinct.size()) ? distinct.get(i + 1).snapshotId() : null;
            Map<String, String> summary = new LinkedHashMap<>();
            if (c.hash() != null) summary.put("nessie.commit", c.hash());
            if (c.message() != null) summary.put("nessie.message", c.message());
            out.add(new SnapshotResponse(
                    c.snapshotId(), parent, c.committedAt(), nessieOperation(c.message()), summary, null));
        }
        return out;
    }

    private static String nessieOperation(String message) {
        if (message == null) return "commit";
        String m = message.toLowerCase();
        for (String op : List.of("append", "overwrite", "replace", "delete")) {
            if (m.contains("iceberg " + op)) return op;
        }
        return "commit";
    }

    public TableStatisticsResponse getStatistics(Long catalogId, String namespace, String tableName) {
        Table table = loadTable(catalogId, namespace, tableName);
        List<Snapshot> snapshots = StreamSupport.stream(table.snapshots().spliterator(), false).toList();

        long totalDataFiles = 0;
        long totalDataSize = 0;
        long totalDeleteFiles = 0;
        long totalRecords = 0;

        Snapshot current = table.currentSnapshot();
        if (current != null && current.summary() != null) {
            totalDataFiles = parseLong(current.summary().get("total-data-files"));
            totalDataSize = parseLong(current.summary().get("total-files-size"));
            totalDeleteFiles = parseLong(current.summary().get("total-delete-files"));
            totalRecords = parseLong(current.summary().get("total-records"));
        }

        Map<String, String> importantProps = new LinkedHashMap<>();
        for (String key : List.of("write.format.default", "write.parquet.compression-codec",
                "commit.retry.num-retries", "write.metadata.delete-after-commit.enabled")) {
            String val = table.properties().get(key);
            if (val != null) importantProps.put(key, val);
        }

        // Nessie: count the commits (full history), not the single Iceberg snapshot.
        int snapshotCount = snapshots.size();
        CatalogConfig statCfg = CatalogConfig.findById(catalogId);
        if (statCfg != null && isNessie(statCfg)) {
            try {
                snapshotCount = nessieSnapshots(statCfg, namespace, tableName).size();
            } catch (Exception ignored) { /* keep the Iceberg count on failure */ }
        }

        return new TableStatisticsResponse(
                namespace, tableName,
                snapshotCount,
                totalDataFiles, totalDataSize, totalDeleteFiles, totalRecords,
                table.spec().fields().size(),
                table.schema().columns().size(),
                table.properties().getOrDefault("format-version", "1").equals("2") ? 2 : 1,
                importantProps
        );
    }

    public DataSampleResponse sampleData(Long catalogId, String namespace, String tableName, int limit) {
        return dataService.sampleData(catalogId, namespace, tableName, limit);
    }

    public int insertData(Long catalogId, String namespace, String tableName, List<Map<String, Object>> rows) {
        return dataService.insertData(catalogId, namespace, tableName, rows);
    }

    public void renameTable(Long catalogId, String namespace, String tableName, String newName) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            TableIdentifier from = TableIdentifier.of(Namespace.of(namespace), tableName);
            TableIdentifier to = TableIdentifier.of(Namespace.of(namespace), newName);
            catalog.renameTable(from, to);
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to rename table: " + e.getMessage(), e);
        }
    }

    // ───────── Lineage / history → TableLineageService ─────────

    public SchemaHistoryResponse getSchemaHistory(Long catalogId, String namespace, String tableName) {
        return lineageService.getSchemaHistory(catalogId, namespace, tableName);
    }

    public SnapshotDiffResponse compareSnapshots(Long catalogId, String namespace, String tableName,
                                                 long fromId, long toId) {
        return lineageService.compareSnapshots(catalogId, namespace, tableName, fromId, toId);
    }

    // ───────── Storage state → TableStorageService ─────────

    public StorageOverviewResponse getStorageOverview(Long catalogId, String namespace, String tableName) {
        return storageService.getStorageOverview(catalogId, namespace, tableName);
    }

    public PartitionPageResponse getStoragePartitions(Long catalogId, String namespace, String tableName,
                                                      int offset, int limit, String sort, String dir, String search) {
        return storageService.getStoragePartitions(catalogId, namespace, tableName, offset, limit, sort, dir, search);
    }

    public StorageFilesResponse listPartitionFiles(Long catalogId, String namespace, String tableName,
                                                    String partition, int limit) {
        return storageService.listPartitionFiles(catalogId, namespace, tableName, partition, limit);
    }


    private Table loadTable(Long catalogId, String namespace, String tableName) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            return catalog.loadTable(TableIdentifier.of(Namespace.of(namespace), tableName));
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to load table " + namespace + "." + tableName, e);
        }
    }

    private RESTCatalog getCatalog(Long catalogId) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        return catalogFactory.getOrCreate(config);
    }

    private Schema buildSchema(List<CreateTableRequest.ColumnDef> columns) {
        List<Types.NestedField> fields = new ArrayList<>();
        int fieldId = 1;
        for (var col : columns) {
            Type type = Types.fromPrimitiveString(col.type());
            fields.add(col.required()
                    ? Types.NestedField.required(fieldId++, col.name(), type, col.doc())
                    : Types.NestedField.optional(fieldId++, col.name(), type, col.doc()));
        }
        return new Schema(fields);
    }

    private PartitionSpec buildPartitionSpec(Schema schema, List<CreateTableRequest.PartitionFieldDef> partitions) {
        if (partitions == null || partitions.isEmpty()) {
            return PartitionSpec.unpartitioned();
        }
        PartitionSpec.Builder builder = PartitionSpec.builderFor(schema);
        for (var pf : partitions) {
            switch (pf.transform().toLowerCase()) {
                case "identity" -> builder.identity(pf.sourceColumn());
                case "year" -> builder.year(pf.sourceColumn());
                case "month" -> builder.month(pf.sourceColumn());
                case "day" -> builder.day(pf.sourceColumn());
                case "hour" -> builder.hour(pf.sourceColumn());
                default -> {
                    if (pf.transform().toLowerCase().startsWith("bucket")) {
                        int n = Integer.parseInt(pf.transform().replaceAll("\\D", ""));
                        builder.bucket(pf.sourceColumn(), n);
                    } else if (pf.transform().toLowerCase().startsWith("truncate")) {
                        int w = Integer.parseInt(pf.transform().replaceAll("\\D", ""));
                        builder.truncate(pf.sourceColumn(), w);
                    } else {
                        builder.identity(pf.sourceColumn());
                    }
                }
            }
        }
        return builder.build();
    }

    private TableResponse mapTableResponse(String namespace, String tableName, Table table) {
        var schemaInfo = new TableResponse.SchemaInfo(
                table.schema().schemaId(),
                table.schema().columns().stream()
                        .map(f -> new TableResponse.ColumnInfo(
                                f.fieldId(), f.name(), f.type().toString(),
                                f.isRequired(), f.doc()))
                        .toList()
        );

        var partitions = table.spec().fields().stream()
                .map(pf -> new TableResponse.PartitionFieldInfo(
                        table.schema().findColumnName(pf.sourceId()),
                        pf.sourceId(),
                        pf.transform().toString(),
                        pf.name()))
                .toList();

        long snapshotId = table.currentSnapshot() != null ? table.currentSnapshot().snapshotId() : -1;

        return new TableResponse(
                namespace, tableName, schemaInfo, partitions,
                table.properties(), table.location(),
                snapshotId, table.schema().schemaId(),
                Integer.parseInt(table.properties().getOrDefault("format-version", "1"))
        );
    }

    private long parseLong(String val) {
        if (val == null) return 0;
        try { return Long.parseLong(val); } catch (NumberFormatException e) { return 0; }
    }
}
