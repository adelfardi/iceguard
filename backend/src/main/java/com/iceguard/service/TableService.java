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

        return new TableStatisticsResponse(
                namespace, tableName,
                snapshots.size(),
                totalDataFiles, totalDataSize, totalDeleteFiles, totalRecords,
                table.spec().fields().size(),
                table.schema().columns().size(),
                table.properties().getOrDefault("format-version", "1").equals("2") ? 2 : 1,
                importantProps
        );
    }

    public DataSampleResponse sampleData(Long catalogId, String namespace, String tableName, int limit) {
        Table table = loadTable(catalogId, namespace, tableName);
        try {
            Schema schema = table.schema();
            List<String> columns = schema.columns().stream()
                    .map(Types.NestedField::name)
                    .toList();

            List<Map<String, Object>> rows = new ArrayList<>();
            int count = 0;
            boolean hasMore = false;

            try (CloseableIterable<Record> records = IcebergGenerics.read(table).build()) {
                for (Record record : records) {
                    if (count >= limit) {
                        hasMore = true;
                        break;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (Types.NestedField field : schema.columns()) {
                        Object value = record.getField(field.name());
                        row.put(field.name(), value != null ? value.toString() : null);
                    }
                    rows.add(row);
                    count++;
                }
            }

            return new DataSampleResponse(columns, rows, rows.size(), hasMore);
        } catch (IOException e) {
            throw new CatalogOperationException("Failed to read sample data: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to sample data from " + namespace + "." + tableName, e);
        }
    }

    public int insertData(Long catalogId, String namespace, String tableName, List<Map<String, Object>> rows) {
        Table table = loadTable(catalogId, namespace, tableName);
        try {
            Schema schema = table.schema();
            PartitionSpec spec = table.spec();

            // Build records once.
            List<GenericRecord> records = new ArrayList<>(rows.size());
            for (Map<String, Object> row : rows) {
                GenericRecord record = GenericRecord.create(schema);
                for (Types.NestedField field : schema.columns()) {
                    Object value = row.get(field.name());
                    if (value != null) {
                        record.setField(field.name(), convertValue(value, field.type()));
                    }
                }
                records.add(record);
            }

            // One append commit => a single snapshot, regardless of how many files are written.
            AppendFiles append = table.newAppend();

            if (spec.isUnpartitioned()) {
                append.appendFile(writeDataFile(table, schema, spec, null, records));
            } else {
                // Group rows by their partition value; write one file per partition.
                Map<org.apache.iceberg.PartitionKey, List<GenericRecord>> groups = new LinkedHashMap<>();
                org.apache.iceberg.PartitionKey key = new org.apache.iceberg.PartitionKey(spec, schema);
                for (GenericRecord record : records) {
                    key.partition(record);
                    groups.computeIfAbsent(key.copy(), k -> new ArrayList<>()).add(record);
                }
                for (var entry : groups.entrySet()) {
                    append.appendFile(writeDataFile(table, schema, spec, entry.getKey(), entry.getValue()));
                }
            }

            append.commit();
            return rows.size();
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to insert data: " + e.getMessage(), e);
        }
    }

    private DataFile writeDataFile(Table table, Schema schema, PartitionSpec spec,
                                   org.apache.iceberg.PartitionKey partitionKey,
                                   List<GenericRecord> records) throws IOException {
        String prefix = partitionKey != null ? spec.partitionToPath(partitionKey) + "/" : "";
        String filepath = table.location() + "/data/" + prefix + UUID.randomUUID() + ".parquet";
        OutputFile outputFile = table.io().newOutputFile(filepath);

        DataWriter<Record> writer = Parquet.writeData(outputFile)
                .schema(schema)
                .createWriterFunc(GenericParquetWriter::buildWriter)
                .overwrite()
                .withSpec(spec)
                .withPartition(partitionKey)
                .build();
        try {
            for (GenericRecord record : records) {
                writer.write(record);
            }
        } finally {
            writer.close();
        }
        return writer.toDataFile();
    }

    private Object convertValue(Object value, Type type) {
        if (value == null) return null;
        String str = value.toString();
        return switch (type.typeId()) {
            case STRING -> str;
            case LONG -> value instanceof Number n ? n.longValue() : Long.parseLong(str);
            case INTEGER -> value instanceof Number n ? n.intValue() : Integer.parseInt(str);
            case DOUBLE -> value instanceof Number n ? n.doubleValue() : Double.parseDouble(str);
            case FLOAT -> value instanceof Number n ? n.floatValue() : Float.parseFloat(str);
            case BOOLEAN -> value instanceof Boolean b ? b : Boolean.parseBoolean(str);
            case DATE -> (int) LocalDate.parse(str).toEpochDay();
            case TIMESTAMP -> {
                if (value instanceof OffsetDateTime odt) {
                    yield odt;
                }
                yield OffsetDateTime.parse(str);
            }
            case DECIMAL -> new BigDecimal(str);
            default -> str;
        };
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

    // ───────────────────────── Lineage / history ─────────────────────────

    private static final List<String[]> DIFF_METRICS = List.of(
            new String[]{"total-records", "Records"},
            new String[]{"total-data-files", "Data files"},
            new String[]{"total-files-size", "Total size (bytes)"},
            new String[]{"total-delete-files", "Delete files"}
    );

    public SchemaHistoryResponse getSchemaHistory(Long catalogId, String namespace, String tableName) {
        Table table = loadTable(catalogId, namespace, tableName);

        // Earliest snapshot per schema id (chronological).
        Map<Integer, Snapshot> firstSnapBySchema = new HashMap<>();
        StreamSupport.stream(table.snapshots().spliterator(), false)
                .sorted(Comparator.comparingLong(Snapshot::timestampMillis))
                .forEach(s -> {
                    if (s.schemaId() != null) firstSnapBySchema.putIfAbsent(s.schemaId(), s);
                });

        List<Integer> ids = new ArrayList<>(table.schemas().keySet());
        Collections.sort(ids);

        List<SchemaHistoryResponse.SchemaVersion> versions = new ArrayList<>();
        Schema prev = null;
        for (Integer id : ids) {
            Schema sc = table.schemas().get(id);
            SchemaDiff diff = prev == null ? null : diffSchemas(prev, sc);
            Snapshot snap = firstSnapBySchema.get(id);
            versions.add(new SchemaHistoryResponse.SchemaVersion(
                    id,
                    snap != null ? snap.snapshotId() : null,
                    snap != null ? Instant.ofEpochMilli(snap.timestampMillis()) : null,
                    sc.columns().size(),
                    toColumnRefs(sc),
                    diff,
                    id == table.schema().schemaId()
            ));
            prev = sc;
        }
        return new SchemaHistoryResponse(namespace, tableName, table.schema().schemaId(), versions);
    }

    public SnapshotDiffResponse compareSnapshots(Long catalogId, String namespace, String tableName,
                                                 long fromId, long toId) {
        Table table = loadTable(catalogId, namespace, tableName);
        Snapshot from = table.snapshot(fromId);
        Snapshot to = table.snapshot(toId);
        if (from == null) throw new IllegalArgumentException("Snapshot not found: " + fromId);
        if (to == null) throw new IllegalArgumentException("Snapshot not found: " + toId);

        List<SnapshotDiffResponse.MetricDelta> metrics = new ArrayList<>();
        for (String[] m : DIFF_METRICS) {
            long f = parseLong(from.summary() != null ? from.summary().get(m[0]) : null);
            long t = parseLong(to.summary() != null ? to.summary().get(m[0]) : null);
            metrics.add(new SnapshotDiffResponse.MetricDelta(m[0], m[1], f, t, t - f));
        }

        SchemaDiff schemaDiff = null;
        if (from.schemaId() != null && to.schemaId() != null
                && !from.schemaId().equals(to.schemaId())) {
            Schema fs = table.schemas().get(from.schemaId());
            Schema ts = table.schemas().get(to.schemaId());
            if (fs != null && ts != null) schemaDiff = diffSchemas(fs, ts);
        }

        return new SnapshotDiffResponse(brief(from), brief(to), metrics, schemaDiff);
    }

    private SnapshotDiffResponse.SnapshotBrief brief(Snapshot s) {
        return new SnapshotDiffResponse.SnapshotBrief(
                s.snapshotId(), Instant.ofEpochMilli(s.timestampMillis()),
                s.operation(), s.schemaId());
    }

    private List<SchemaDiff.ColumnRef> toColumnRefs(Schema schema) {
        return schema.columns().stream()
                .map(f -> new SchemaDiff.ColumnRef(f.fieldId(), f.name(), f.type().toString(), f.isRequired()))
                .toList();
    }

    private SchemaDiff diffSchemas(Schema oldS, Schema newS) {
        Map<Integer, Types.NestedField> oldM = new LinkedHashMap<>();
        for (Types.NestedField f : oldS.columns()) oldM.put(f.fieldId(), f);
        Map<Integer, Types.NestedField> newM = new LinkedHashMap<>();
        for (Types.NestedField f : newS.columns()) newM.put(f.fieldId(), f);

        List<SchemaDiff.ColumnRef> added = new ArrayList<>();
        List<SchemaDiff.ColumnRef> dropped = new ArrayList<>();
        List<SchemaDiff.ColumnChange> modified = new ArrayList<>();
        int unchanged = 0;

        for (var e : newM.entrySet()) {
            if (!oldM.containsKey(e.getKey())) added.add(ref(e.getValue()));
        }
        for (var e : oldM.entrySet()) {
            if (!newM.containsKey(e.getKey())) dropped.add(ref(e.getValue()));
        }
        for (var e : oldM.entrySet()) {
            Types.NestedField nf = newM.get(e.getKey());
            if (nf == null) continue;
            Types.NestedField of = e.getValue();
            List<String> parts = new ArrayList<>();
            String kind = null;
            if (!of.name().equals(nf.name())) {
                parts.add("renamed " + of.name() + " → " + nf.name());
                kind = "RENAMED";
            }
            if (!of.type().toString().equals(nf.type().toString())) {
                parts.add("type " + of.type() + " → " + nf.type());
                kind = "TYPE_CHANGED";
            }
            if (of.isRequired() != nf.isRequired()) {
                parts.add(nf.isRequired() ? "now required" : "now optional");
                if (kind == null) kind = "NULLABILITY";
            }
            if (parts.isEmpty()) {
                unchanged++;
            } else {
                modified.add(new SchemaDiff.ColumnChange(
                        nf.fieldId(), nf.name(), kind, String.join("; ", parts)));
            }
        }

        return new SchemaDiff(oldS.schemaId(), newS.schemaId(), added, dropped, modified, unchanged);
    }

    private SchemaDiff.ColumnRef ref(Types.NestedField f) {
        return new SchemaDiff.ColumnRef(f.fieldId(), f.name(), f.type().toString(), f.isRequired());
    }

    // ───────────────────────── Storage state ─────────────────────────

    private static final long[] SIZE_EDGES = {
            1L << 20, 8L << 20, 32L << 20, 128L << 20, 512L << 20
    };
    private static final String[] SIZE_LABELS = {
            "< 1 MB", "1–8 MB", "8–32 MB", "32–128 MB", "128–512 MB", "> 512 MB"
    };

    public StorageOverviewResponse getStorageOverview(Long catalogId, String namespace, String tableName) {
        Table table = loadTable(catalogId, namespace, tableName);
        long targetSize = parseLong(table.properties().getOrDefault(
                "write.target-file-size-bytes", "536870912"));
        List<String> partitionFields = table.spec().fields().stream()
                .map(org.apache.iceberg.PartitionField::name).toList();
        boolean partitioned = !partitionFields.isEmpty();

        Snapshot snapshot = table.currentSnapshot();
        if (snapshot == null) {
            return new StorageOverviewResponse(namespace, tableName, partitioned, partitionFields,
                    -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, targetSize, 0, 0, emptyHistogram());
        }

        StorageScan scan = scanStorage(table, snapshot);

        List<StorageOverviewResponse.FileSizeBucket> histogram = new ArrayList<>();
        for (int i = 0; i < SIZE_LABELS.length; i++) {
            histogram.add(new StorageOverviewResponse.FileSizeBucket(
                    SIZE_LABELS[i], scan.bucketCount[i], scan.bucketBytes[i]));
        }

        long maxPartitionSize = scan.byPartition.values().stream()
                .mapToLong(a -> a.totalSize).max().orElse(0);

        return new StorageOverviewResponse(
                namespace, tableName, partitioned, partitionFields,
                snapshot.snapshotId(),
                scan.dataFiles, scan.deleteFiles, scan.posDel, scan.eqDel,
                scan.totalSize, scan.totalRecords,
                scan.dataFiles == 0 ? 0 : scan.minSize, scan.maxSize,
                scan.dataFiles == 0 ? 0 : scan.totalSize / scan.dataFiles,
                targetSize, scan.byPartition.size(), maxPartitionSize, histogram);
    }

    /** Server-side paginated, filtered and sorted partition list. */
    public PartitionPageResponse getStoragePartitions(Long catalogId, String namespace, String tableName,
                                                      int offset, int limit, String sort, String dir, String search) {
        Table table = loadTable(catalogId, namespace, tableName);
        Snapshot snapshot = table.currentSnapshot();
        if (snapshot == null) {
            return new PartitionPageResponse(0, offset, limit, List.of());
        }

        StorageScan scan = scanStorage(table, snapshot);

        String q = search == null ? "" : search.trim().toLowerCase();
        Comparator<StorageOverviewResponse.PartitionStorage> cmp = switch (sort == null ? "size" : sort) {
            case "files" -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::dataFileCount);
            case "records" -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::recordCount);
            case "name" -> Comparator.comparing(StorageOverviewResponse.PartitionStorage::path);
            default -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::totalSizeBytes);
        };
        if (!"asc".equalsIgnoreCase(dir)) cmp = cmp.reversed();

        List<StorageOverviewResponse.PartitionStorage> all = scan.byPartition.values().stream()
                .map(Agg::toResponse)
                .filter(p -> q.isEmpty()
                        || (p.path().isEmpty() ? "unpartitioned" : p.path().toLowerCase()).contains(q))
                .sorted(cmp)
                .toList();

        int total = all.size();
        int from = Math.max(0, offset);
        int to = limit <= 0 ? total : Math.min(total, from + limit);
        List<StorageOverviewResponse.PartitionStorage> page = from >= total ? List.of() : all.subList(from, to);

        return new PartitionPageResponse(total, from, limit, page);
    }

    /** Single full pass over the current snapshot's manifests. */
    private StorageScan scanStorage(Table table, Snapshot snapshot) {
        Map<String, Agg> byPartition = new LinkedHashMap<>();
        long[] bucketCount = new long[SIZE_LABELS.length];
        long[] bucketBytes = new long[SIZE_LABELS.length];
        long totalSize = 0, totalRecords = 0, dataFiles = 0;
        long minSize = Long.MAX_VALUE, maxSize = 0;
        long deleteFiles = 0, posDel = 0, eqDel = 0;

        FileIO io = table.io();
        Map<Integer, PartitionSpec> specs = table.specs();

        try {
            for (ManifestFile mf : snapshot.dataManifests(io)) {
                try (ManifestReader<DataFile> reader = ManifestFiles.read(mf, io, specs)) {
                    for (DataFile df : reader) {
                        PartitionSpec spec = specs.get(df.specId());
                        String path = spec.partitionToPath(df.partition());
                        long size = df.fileSizeInBytes();
                        long rec = df.recordCount();
                        byPartition.computeIfAbsent(path, k -> new Agg(k, df.specId()))
                                .addData(size, rec);
                        totalSize += size;
                        totalRecords += rec;
                        dataFiles++;
                        minSize = Math.min(minSize, size);
                        maxSize = Math.max(maxSize, size);
                        int b = bucketIndex(size);
                        bucketCount[b]++;
                        bucketBytes[b] += size;
                    }
                }
            }
            for (ManifestFile mf : snapshot.deleteManifests(io)) {
                try (ManifestReader<DeleteFile> reader = ManifestFiles.readDeleteManifest(mf, io, specs)) {
                    for (DeleteFile df : reader) {
                        PartitionSpec spec = specs.get(df.specId());
                        String path = spec.partitionToPath(df.partition());
                        boolean position = df.content() == FileContent.POSITION_DELETES;
                        byPartition.computeIfAbsent(path, k -> new Agg(k, df.specId()))
                                .addDelete(position);
                        deleteFiles++;
                        if (position) posDel++; else eqDel++;
                    }
                }
            }
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to read storage manifests: " + e.getMessage(), e);
        }

        StorageScan s = new StorageScan();
        s.byPartition = byPartition;
        s.bucketCount = bucketCount;
        s.bucketBytes = bucketBytes;
        s.totalSize = totalSize;
        s.totalRecords = totalRecords;
        s.dataFiles = dataFiles;
        s.minSize = minSize;
        s.maxSize = maxSize;
        s.deleteFiles = deleteFiles;
        s.posDel = posDel;
        s.eqDel = eqDel;
        return s;
    }

    private static final class StorageScan {
        Map<String, Agg> byPartition;
        long[] bucketCount;
        long[] bucketBytes;
        long totalSize, totalRecords, dataFiles, minSize, maxSize, deleteFiles, posDel, eqDel;
    }

    public StorageFilesResponse listPartitionFiles(Long catalogId, String namespace, String tableName,
                                                    String partition, int limit) {
        Table table = loadTable(catalogId, namespace, tableName);
        Snapshot snapshot = table.currentSnapshot();
        List<StorageFilesResponse.FileEntry> files = new ArrayList<>();
        boolean truncated = false;

        if (snapshot != null) {
            FileIO io = table.io();
            Map<Integer, PartitionSpec> specs = table.specs();
            try {
                outer:
                for (ManifestFile mf : snapshot.dataManifests(io)) {
                    try (ManifestReader<DataFile> reader = ManifestFiles.read(mf, io, specs)) {
                        for (DataFile df : reader) {
                            String path = specs.get(df.specId()).partitionToPath(df.partition());
                            if (partition != null && !partition.equals(path)) continue;
                            if (files.size() >= limit) { truncated = true; break outer; }
                            files.add(new StorageFilesResponse.FileEntry(
                                    df.path().toString(), "DATA",
                                    df.fileSizeInBytes(), df.recordCount(), df.specId()));
                        }
                    }
                }
                if (!truncated) {
                    deletes:
                    for (ManifestFile mf : snapshot.deleteManifests(io)) {
                        try (ManifestReader<DeleteFile> reader = ManifestFiles.readDeleteManifest(mf, io, specs)) {
                            for (DeleteFile df : reader) {
                                String path = specs.get(df.specId()).partitionToPath(df.partition());
                                if (partition != null && !partition.equals(path)) continue;
                                if (files.size() >= limit) { truncated = true; break deletes; }
                                files.add(new StorageFilesResponse.FileEntry(
                                        df.path().toString(), df.content().name(),
                                        df.fileSizeInBytes(), df.recordCount(), df.specId()));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                throw new CatalogOperationException("Failed to list partition files: " + e.getMessage(), e);
            }
        }
        return new StorageFilesResponse(partition, files.size(), truncated, files);
    }

    private int bucketIndex(long size) {
        for (int i = 0; i < SIZE_EDGES.length; i++) {
            if (size < SIZE_EDGES[i]) return i;
        }
        return SIZE_LABELS.length - 1;
    }

    private List<StorageOverviewResponse.FileSizeBucket> emptyHistogram() {
        List<StorageOverviewResponse.FileSizeBucket> h = new ArrayList<>();
        for (String label : SIZE_LABELS) {
            h.add(new StorageOverviewResponse.FileSizeBucket(label, 0, 0));
        }
        return h;
    }

    /** Per-partition accumulator. */
    private static final class Agg {
        final String path;
        final int specId;
        long dataFileCount, totalSize, records, deleteFileCount, posDel, eqDel;
        long minSize = Long.MAX_VALUE, maxSize = 0;

        Agg(String path, int specId) {
            this.path = path;
            this.specId = specId;
        }

        void addData(long size, long rec) {
            dataFileCount++;
            totalSize += size;
            records += rec;
            minSize = Math.min(minSize, size);
            maxSize = Math.max(maxSize, size);
        }

        void addDelete(boolean position) {
            deleteFileCount++;
            if (position) posDel++; else eqDel++;
        }

        StorageOverviewResponse.PartitionStorage toResponse() {
            List<StorageOverviewResponse.PartitionValue> values = new ArrayList<>();
            if (path != null && !path.isEmpty()) {
                for (String part : path.split("/")) {
                    int eq = part.indexOf('=');
                    if (eq > 0) {
                        values.add(new StorageOverviewResponse.PartitionValue(
                                part.substring(0, eq), part.substring(eq + 1)));
                    }
                }
            }
            return new StorageOverviewResponse.PartitionStorage(
                    path, values, specId,
                    dataFileCount, deleteFileCount, posDel, eqDel,
                    totalSize,
                    dataFileCount == 0 ? 0 : minSize, maxSize,
                    dataFileCount == 0 ? 0 : totalSize / dataFileCount,
                    records);
        }
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
