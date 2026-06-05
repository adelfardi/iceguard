package com.iceguard.executor;

import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.model.CatalogConfig;
import com.iceguard.repository.CatalogConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.io.FileIO;
import org.apache.iceberg.rest.RESTCatalog;

import java.util.*;

@ApplicationScoped
public class JavaApiExecutor implements MaintenanceExecutor {

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

    @Override
    public MaintenanceResult rewriteDataFiles(ExecutorContext ctx, Map<String, String> options) {
        try {
            Table table = loadTable(ctx);

            // Rewriting data files (compaction) requires a compute engine like Spark.
            // Without Spark, we provide diagnostic information about the table's data files
            // so the user knows what would benefit from compaction.
            Snapshot current = table.currentSnapshot();
            if (current == null) {
                return MaintenanceResult.success("Table has no snapshots - nothing to compact", Map.of(
                        "table", ctx.tableName()
                ));
            }

            Map<String, String> summary = current.summary();
            long totalDataFiles = parseLong(summary.get("total-data-files"));
            long totalFileSize = parseLong(summary.get("total-files-size"));
            long totalRecords = parseLong(summary.get("total-records"));

            long avgFileSize = totalDataFiles > 0 ? totalFileSize / totalDataFiles : 0;

            // Target file size from table properties (default 512MB)
            String targetSizeStr = table.properties().getOrDefault(
                    "write.target-file-size-bytes", "536870912");
            long targetSize = parseLong(targetSizeStr);

            // Files smaller than half the target size are candidates for compaction
            boolean needsCompaction = totalDataFiles > 1 && avgFileSize < (targetSize / 2);

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("table", ctx.tableName());
            details.put("totalDataFiles", totalDataFiles);
            details.put("totalFileSize", totalFileSize);
            details.put("totalRecords", totalRecords);
            details.put("avgFileSize", avgFileSize);
            details.put("targetFileSize", targetSize);
            details.put("needsCompaction", needsCompaction);
            details.put("note", "Data file compaction requires a compute engine (Spark/Flink). " +
                    "Use the Spark executor for production compaction.");

            return MaintenanceResult.success(
                    needsCompaction
                            ? "Table has " + totalDataFiles + " data files with avg size " +
                              formatBytes(avgFileSize) + " (target: " + formatBytes(targetSize) +
                              "). Compaction recommended."
                            : "Table data files are within acceptable size range. No compaction needed.",
                    details
            );
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to analyze data files: " + e.getMessage());
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

            // Count manifests before rewrite
            int manifestsBefore = current.allManifests(table.io()).size();

            RewriteManifests rewrite = table.rewriteManifests();
            rewrite.rewriteIf(manifest -> true);
            rewrite.commit();

            // Count manifests after rewrite
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

    @Override
    public MaintenanceResult removeOrphanFiles(ExecutorContext ctx, Map<String, String> options) {
        try {
            Table table = loadTable(ctx);

            Snapshot current = table.currentSnapshot();
            if (current == null) {
                return MaintenanceResult.success("Table has no snapshots - no orphan detection possible", Map.of(
                        "table", ctx.tableName()
                ));
            }

            // Collect all known files referenced by the table metadata
            Set<String> knownFiles = new HashSet<>();

            // Add metadata files
            FileIO io = table.io();

            // Collect data files and delete files from all snapshots
            for (Snapshot snapshot : table.snapshots()) {
                // Manifest list
                knownFiles.add(snapshot.manifestListLocation());

                // All manifests and their data/delete files
                for (ManifestFile manifest : snapshot.allManifests(io)) {
                    knownFiles.add(manifest.path());
                }
            }

            // Collect data file paths from current snapshot manifests
            Set<String> dataFiles = new HashSet<>();
            for (ManifestFile manifest : current.dataManifests(io)) {
                try (ManifestReader<DataFile> reader = ManifestFiles.read(manifest, io)) {
                    for (DataFile dataFile : reader) {
                        dataFiles.add(dataFile.path().toString());
                    }
                }
            }

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("table", ctx.tableName());
            details.put("knownMetadataFiles", knownFiles.size());
            details.put("knownDataFiles", dataFiles.size());
            details.put("tableLocation", table.location());
            details.put("note", "Full orphan file removal requires listing the filesystem at the table location " +
                    "and comparing with known files. For production use, consider using the Spark-based " +
                    "removeOrphanFiles action which handles this safely with configurable retention periods.");

            return MaintenanceResult.success(
                    "Orphan file analysis complete. Found " + knownFiles.size() +
                    " metadata files and " + dataFiles.size() + " data files tracked by the table.",
                    details
            );
        } catch (Exception e) {
            return MaintenanceResult.failure("Failed to analyze orphan files: " + e.getMessage());
        }
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
