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
