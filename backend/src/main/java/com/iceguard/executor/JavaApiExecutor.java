package com.iceguard.executor;

import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.model.CatalogConfig;
import com.iceguard.repository.CatalogConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.data.IcebergGenerics;
import org.apache.iceberg.data.InternalRecordWrapper;
import org.apache.iceberg.data.Record;
import org.apache.iceberg.data.parquet.GenericParquetWriter;
import org.apache.iceberg.io.*;
import org.apache.iceberg.parquet.Parquet;
import org.apache.iceberg.rest.RESTCatalog;

import java.io.IOException;
import java.util.*;

/**
 * Maintenance via the pure Iceberg Java API — no compute engine.
 *
 * <p>Metadata-only operations are always real: {@link #expireSnapshots}, {@link #rollbackToSnapshot}
 * and {@link #rewriteManifests}. The data-plane operations {@link #rewriteDataFiles} (compaction)
 * and {@link #removeOrphanFiles} are <b>also real here</b>, but deliberately bounded to small,
 * simple tables by hard-coded safety limits (see the constants below). Above those limits, or for
 * merge-on-read tables, they refuse with an error and you should use the Spark executor
 * ({@code engine=spark}), which parallelises the work and handles deletes/partitioning at scale.
 */
@ApplicationScoped
public class JavaApiExecutor implements MaintenanceExecutor {

    /** Default Iceberg target data-file size (512 MiB) when the table property is unset. */
    private static final long DEFAULT_TARGET_FILE_SIZE = 512L * 1024 * 1024;

    // ── Hard safety limits for the single-node Java executor (tune here). ──
    /** Max total data size a single compaction run will read/rewrite in-process. */
    private static final long MAX_COMPACTION_TOTAL_BYTES = 256L * 1024 * 1024; // 256 MiB
    /** Max number of data files a single compaction run will touch. */
    private static final int MAX_COMPACTION_FILES = 1000;
    /** Orphan removal only deletes files older than this (protects in-flight commits). */
    private static final long ORPHAN_MIN_AGE_HOURS = 24;
    /** Orphan removal refuses if more than this many files are found under the table location. */
    private static final long MAX_ORPHAN_SCAN = 100_000;

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    @Inject
    CatalogConfigRepository catalogConfigRepository;

    @Override
    public String name() {
        return "java-api";
    }

    @Override
    public MaintenanceResult expireSnapshots(ExecutorContext ctx, Long olderThanMs, Integer retainLast) {
        try {
            Table table = loadTable(ctx);
            ExpireSnapshots expire = table.expireSnapshots();

            if (olderThanMs != null) {
                expire.expireOlderThan(System.currentTimeMillis() - olderThanMs);
            }
            if (retainLast != null) {
                expire.retainLast(retainLast);
            }

            expire.commit();
            return MaintenanceResult.success("Snapshots expired successfully", Map.of(
                    "table", ctx.tableName(),
                    "olderThanMs", olderThanMs != null ? olderThanMs : "N/A",
                    "retainLast", retainLast != null ? retainLast : "N/A"
            ));
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to expire snapshots: " + e.getMessage());
        }
    }

    @Override
    public MaintenanceResult rollbackToSnapshot(ExecutorContext ctx, long snapshotId) {
        try {
            Table table = loadTable(ctx);
            table.manageSnapshots().setCurrentSnapshot(snapshotId).commit();
            return MaintenanceResult.success("Rolled back to snapshot " + snapshotId, Map.of(
                    "table", ctx.tableName(),
                    "snapshotId", snapshotId
            ));
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to rollback: " + e.getMessage());
        }
    }

    /**
     * Real, single-node compaction. Reads every row of the current snapshot and streams it into
     * fresh, target-sized Parquet files (partition-aware, rolling over at the target size), then
     * atomically swaps the old files for the new ones with {@link RewriteFiles}
     * ({@code table.newRewrite()}).
     *
     * <p>Refuses (returns an error, applies nothing) when the table has delete files (merge-on-read),
     * when its data exceeds {@value #MAX_COMPACTION_TOTAL_BYTES} bytes, or when it has more than
     * {@value #MAX_COMPACTION_FILES} data files — use the Spark executor for those.
     */
    @Override
    public MaintenanceResult rewriteDataFiles(ExecutorContext ctx, Map<String, String> options) {
        try {
            Table table = loadTable(ctx);
            Snapshot current = table.currentSnapshot();
            if (current == null) {
                return MaintenanceResult.success("Table has no snapshots - nothing to compact",
                        Map.of("table", ctx.tableName()));
            }

            Map<String, String> summary = current.summary();
            long totalDeleteFiles = parseLong(summary.get("total-delete-files"));
            if (totalDeleteFiles > 0) {
                return MaintenanceResult.failure(
                        "Table has " + totalDeleteFiles + " delete file(s) (merge-on-read). The java-api "
                        + "executor only compacts append-only tables — use the Spark executor.");
            }

            long totalDataFiles = parseLong(summary.get("total-data-files"));
            long totalFileSize = parseLong(summary.get("total-files-size"));
            long targetSize = parseLong(table.properties()
                    .getOrDefault("write.target-file-size-bytes", String.valueOf(DEFAULT_TARGET_FILE_SIZE)));
            if (targetSize <= 0) {
                targetSize = DEFAULT_TARGET_FILE_SIZE;
            }
            long avgFileSize = totalDataFiles > 0 ? totalFileSize / totalDataFiles : 0;

            // ── Hard safety limits: above these, do NOT apply — return an error. ──
            if (totalFileSize > MAX_COMPACTION_TOTAL_BYTES) {
                return MaintenanceResult.failure(
                        "Table data size " + formatBytes(totalFileSize) + " exceeds the java-api compaction "
                        + "limit of " + formatBytes(MAX_COMPACTION_TOTAL_BYTES) + " — use the Spark executor.");
            }
            if (totalDataFiles > MAX_COMPACTION_FILES) {
                return MaintenanceResult.failure(
                        "Table has " + totalDataFiles + " data files, above the java-api limit of "
                        + MAX_COMPACTION_FILES + " — use the Spark executor.");
            }

            // Nothing worth doing.
            if (totalDataFiles < 2 || avgFileSize >= targetSize / 2) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("table", ctx.tableName());
                d.put("totalDataFiles", totalDataFiles);
                d.put("avgFileSize", avgFileSize);
                d.put("targetFileSize", targetSize);
                d.put("compacted", false);
                return MaintenanceResult.success(
                        "Data files are already within the target size — no compaction needed.", d);
            }

            // ── The data files we will replace (current snapshot). ──
            Map<String, DataFile> oldByPath = new LinkedHashMap<>();
            try (CloseableIterable<FileScanTask> tasks = table.newScan().planFiles()) {
                for (FileScanTask task : tasks) {
                    oldByPath.put(task.file().path().toString(), task.file());
                }
            }

            // ── Read all rows and stream them into new target-sized files (partition-aware). ──
            Schema schema = table.schema();
            PartitionSpec spec = table.spec();
            InternalRecordWrapper wrapper = new InternalRecordWrapper(schema.asStruct());
            PartitionKey key = new PartitionKey(spec, schema);
            Map<String, DataWriter<Record>> open = new LinkedHashMap<>(); // partition path -> open writer
            Map<String, PartitionKey> partKeys = new LinkedHashMap<>();
            List<DataFile> newFiles = new ArrayList<>();
            long rows = 0;

            try (CloseableIterable<Record> records = IcebergGenerics.read(table).build()) {
                for (Record record : records) {
                    String pPath;
                    PartitionKey pk;
                    if (spec.isUnpartitioned()) {
                        pPath = "";
                        pk = null;
                    } else {
                        key.partition(wrapper.wrap(record));
                        pPath = spec.partitionToPath(key);
                        pk = key.copy();
                    }
                    DataWriter<Record> writer = open.get(pPath);
                    if (writer == null) {
                        writer = newWriter(table, schema, spec, pk);
                        open.put(pPath, writer);
                        partKeys.put(pPath, pk);
                    }
                    writer.write(record);
                    rows++;
                    // Roll over to a new file once the current one reaches the target size.
                    if (writer.length() >= targetSize) {
                        writer.close();
                        newFiles.add(writer.toDataFile());
                        open.put(pPath, newWriter(table, schema, spec, partKeys.get(pPath)));
                    }
                }
            }
            for (DataWriter<Record> writer : open.values()) {
                writer.close();
                newFiles.add(writer.toDataFile());
            }

            if (newFiles.isEmpty() || oldByPath.isEmpty()) {
                return MaintenanceResult.success("Nothing to compact.", Map.of("table", ctx.tableName()));
            }

            // ── Atomic swap: replace the old files with the rewritten ones. ──
            RewriteFiles rewrite = table.newRewrite();
            rewrite.rewriteFiles(new HashSet<>(oldByPath.values()), new HashSet<>(newFiles));
            rewrite.commit();

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("table", ctx.tableName());
            details.put("filesBefore", oldByPath.size());
            details.put("filesAfter", newFiles.size());
            details.put("rowsRewritten", rows);
            details.put("targetFileSize", targetSize);
            details.put("compacted", true);
            return MaintenanceResult.success(
                    "Compacted " + oldByPath.size() + " files into " + newFiles.size()
                    + " (" + rows + " rows).", details);
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to compact data files: " + e.getMessage());
        }
    }

    @Override
    public MaintenanceResult rewriteManifests(ExecutorContext ctx, Map<String, String> options) {
        try {
            Table table = loadTable(ctx);

            Snapshot current = table.currentSnapshot();
            if (current == null) {
                return MaintenanceResult.success("Table has no snapshots - nothing to rewrite", Map.of(
                        "table", ctx.tableName()
                ));
            }

            int manifestsBefore = current.allManifests(table.io()).size();

            RewriteManifests rewrite = table.rewriteManifests();
            rewrite.rewriteIf(manifest -> true);
            rewrite.commit();

            Snapshot afterSnapshot = table.currentSnapshot();
            int manifestsAfter = afterSnapshot != null
                    ? afterSnapshot.allManifests(table.io()).size()
                    : 0;

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("table", ctx.tableName());
            details.put("manifestsBefore", manifestsBefore);
            details.put("manifestsAfter", manifestsAfter);

            return MaintenanceResult.success(
                    "Manifests rewritten successfully (before: " + manifestsBefore +
                    ", after: " + manifestsAfter + ")",
                    details
            );
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to rewrite manifests: " + e.getMessage());
        }
    }

    /**
     * Real orphan-file removal. Builds the set of files referenced by the table — metadata files,
     * manifest lists, manifests, and the data/delete files of <b>every</b> snapshot (so files still
     * reachable via time-travel are never touched) — then lists the table location through the
     * {@link FileIO} and deletes whatever is not referenced.
     *
     * <p>Safety guards: only files older than {@value #ORPHAN_MIN_AGE_HOURS}h are removed (protects
     * in-flight commits); it refuses if the FileIO cannot list (not S3/HDFS-like) or if more than
     * {@value #MAX_ORPHAN_SCAN} files are found under the location — use the Spark executor for those.
     */
    @Override
    public MaintenanceResult removeOrphanFiles(ExecutorContext ctx, Map<String, String> options) {
        try {
            Table table = loadTable(ctx);
            Snapshot current = table.currentSnapshot();
            if (current == null) {
                return MaintenanceResult.success("Table has no snapshots - nothing to clean", Map.of(
                        "table", ctx.tableName()
                ));
            }

            FileIO io = table.io();
            if (!(io instanceof SupportsPrefixOperations listIo)) {
                return MaintenanceResult.failure(
                        "FileIO " + io.getClass().getSimpleName() + " cannot list files; orphan removal "
                        + "needs a listable store (S3/HDFS) — use the Spark executor.");
            }

            // ── Everything the table currently references. ──
            Set<String> referenced = new HashSet<>();
            if (table instanceof HasTableOperations hto) {
                TableMetadata md = hto.operations().current();
                referenced.add(md.metadataFileLocation());
                md.previousFiles().forEach(e -> referenced.add(e.file()));
            }
            for (Snapshot snapshot : table.snapshots()) {
                referenced.add(snapshot.manifestListLocation());
                for (ManifestFile manifest : snapshot.allManifests(io)) {
                    referenced.add(manifest.path());
                }
                // Data + delete files reachable from this snapshot (covers time-travel).
                try (CloseableIterable<FileScanTask> tasks =
                             table.newScan().useSnapshot(snapshot.snapshotId()).planFiles()) {
                    for (FileScanTask task : tasks) {
                        referenced.add(task.file().path().toString());
                        for (DeleteFile delete : task.deletes()) {
                            referenced.add(delete.path().toString());
                        }
                    }
                }
            }

            // ── List the storage and collect unreferenced, sufficiently-old files. ──
            long cutoff = System.currentTimeMillis() - ORPHAN_MIN_AGE_HOURS * 3_600_000L;
            List<String> orphans = new ArrayList<>();
            long scanned = 0;
            for (FileInfo info : listIo.listPrefix(table.location())) {
                if (++scanned > MAX_ORPHAN_SCAN) {
                    return MaintenanceResult.failure(
                            "More than " + MAX_ORPHAN_SCAN + " files under the table location; the java-api "
                            + "executor won't scan that many — use the Spark executor.");
                }
                if (referenced.contains(info.location())) {
                    continue;
                }
                if (info.createdAtMillis() >= cutoff) {
                    continue; // too recent — could belong to an in-flight commit
                }
                orphans.add(info.location());
            }

            int deleted = 0;
            for (String path : orphans) {
                io.deleteFile(path);
                deleted++;
            }

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("table", ctx.tableName());
            details.put("filesScanned", scanned);
            details.put("referencedFiles", referenced.size());
            details.put("orphansDeleted", deleted);
            details.put("minAgeHours", ORPHAN_MIN_AGE_HOURS);
            details.put("sample", orphans.stream().limit(20).toList());
            return MaintenanceResult.success(
                    "Removed " + deleted + " orphan file(s) (scanned " + scanned + ", older than "
                    + ORPHAN_MIN_AGE_HOURS + "h).", details);
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to remove orphan files: " + e.getMessage());
        }
    }

    /** Opens a fresh Parquet data writer for a partition (or the whole table when unpartitioned). */
    private DataWriter<Record> newWriter(Table table, Schema schema, PartitionSpec spec, PartitionKey partitionKey)
            throws IOException {
        String prefix = partitionKey != null ? spec.partitionToPath(partitionKey) + "/" : "";
        String filepath = table.location() + "/data/" + prefix + UUID.randomUUID() + ".parquet";
        OutputFile outputFile = table.io().newOutputFile(filepath);
        return Parquet.writeData(outputFile)
                .schema(schema)
                .createWriterFunc(GenericParquetWriter::create)
                .overwrite()
                .withSpec(spec)
                .withPartition(partitionKey)
                .build();
    }

    private Table loadTable(ExecutorContext ctx) {
        if (ctx.loadedTable() instanceof Table t) {
            return t;
        }
        CatalogConfig config = catalogConfigRepository.find("name", ctx.catalogName())
                .firstResult();
        if (config == null) {
            throw new IllegalStateException("Catalog not found: " + ctx.catalogName());
        }
        RESTCatalog catalog = catalogFactory.getOrCreate(config);
        return catalog.loadTable(TableIdentifier.of(Namespace.of(ctx.namespace()), ctx.tableName()));
    }

    private long parseLong(String val) {
        if (val == null) return 0;
        try {
            return Long.parseLong(val);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
