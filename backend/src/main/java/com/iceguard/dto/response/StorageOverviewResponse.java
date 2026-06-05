package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.util.List;

/** Point-in-time storage state of a table, aggregated from the current snapshot's manifests. */
public record StorageOverviewResponse(
        String namespace,
        String tableName,
        boolean partitioned,
        List<String> partitionFields,
        @JsonSerialize(using = ToStringSerializer.class) long currentSnapshotId,
        long totalDataFiles,
        long totalDeleteFiles,
        long positionDeleteFiles,
        long equalityDeleteFiles,
        long totalSizeBytes,
        long totalRecords,
        long minFileSizeBytes,
        long maxFileSizeBytes,
        long avgFileSizeBytes,
        long targetFileSizeBytes,
        int partitionCount,
        long maxPartitionSizeBytes,
        List<FileSizeBucket> fileSizeHistogram
) {
    public record FileSizeBucket(String label, long count, long totalBytes) {}

    public record PartitionStorage(
            String path,
            List<PartitionValue> values,
            int specId,
            long dataFileCount,
            long deleteFileCount,
            long positionDeleteFiles,
            long equalityDeleteFiles,
            long totalSizeBytes,
            long minFileSizeBytes,
            long maxFileSizeBytes,
            long avgFileSizeBytes,
            long recordCount
    ) {}

    public record PartitionValue(String field, String value) {}
}
