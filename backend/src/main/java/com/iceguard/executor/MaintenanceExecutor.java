package com.iceguard.executor;

import java.util.Map;

public interface MaintenanceExecutor {

    String name();

    MaintenanceResult expireSnapshots(ExecutorContext ctx, Long olderThanMs, Integer retainLast);

    MaintenanceResult rollbackToSnapshot(ExecutorContext ctx, long snapshotId);

    default MaintenanceResult rewriteDataFiles(ExecutorContext ctx, Map<String, String> options) {
        return MaintenanceResult.unsupported("rewriteDataFiles not supported by " + name());
    }

    default MaintenanceResult rewriteManifests(ExecutorContext ctx, Map<String, String> options) {
        return MaintenanceResult.unsupported("rewriteManifests not supported by " + name());
    }

    default MaintenanceResult removeOrphanFiles(ExecutorContext ctx, Map<String, String> options) {
        return MaintenanceResult.unsupported("removeOrphanFiles not supported by " + name());
    }

    /** Compact position-delete files (merge-on-read). Requires a compute engine (Spark). */
    default MaintenanceResult rewritePositionDeletes(ExecutorContext ctx, Map<String, String> options) {
        return MaintenanceResult.unsupported("rewritePositionDeletes not supported by " + name());
    }

    /**
     * Remove equality-delete files by rewriting the data files that carry them. Iceberg has no
     * dedicated procedure for this, so it is realised through {@code rewrite_data_files}. Requires
     * a compute engine (Spark).
     */
    default MaintenanceResult rewriteEqualityDeletes(ExecutorContext ctx, Map<String, String> options) {
        return MaintenanceResult.unsupported("rewriteEqualityDeletes not supported by " + name());
    }

    record ExecutorContext(
            String catalogName,
            String catalogUri,
            String warehouse,
            Map<String, String> catalogProperties,
            String namespace,
            String tableName,
            Object loadedTable
    ) {
        public ExecutorContext(String catalogName, String catalogUri, String warehouse,
                              Map<String, String> catalogProperties, String namespace, String tableName) {
            this(catalogName, catalogUri, warehouse, catalogProperties, namespace, tableName, null);
        }
    }

    record MaintenanceResult(
            boolean success,
            String message,
            Map<String, Object> details
    ) {
        public static MaintenanceResult success(String message, Map<String, Object> details) {
            return new MaintenanceResult(true, message, details);
        }

        public static MaintenanceResult failure(String message) {
            return new MaintenanceResult(false, message, Map.of());
        }

        public static MaintenanceResult unsupported(String message) {
            return new MaintenanceResult(false, message, Map.of("reason", "UNSUPPORTED"));
        }
    }
}
