package com.iceguard.dto.response;

import java.util.Map;

public record TableStatisticsResponse(
        String namespace,
        String tableName,
        int snapshotCount,
        long totalDataFiles,
        long totalDataSizeBytes,
        long totalDeleteFiles,
        long totalRecords,
        int partitionFieldCount,
        int schemaColumnCount,
        int formatVersion,
        Map<String, String> importantProperties
) {}
