package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.util.List;
import java.util.Map;

public record TableResponse(
        String namespace,
        String name,
        SchemaInfo schema,
        List<PartitionFieldInfo> partitionSpec,
        Map<String, String> properties,
        String location,
        @JsonSerialize(using = ToStringSerializer.class) long currentSnapshotId,
        int schemaId,
        int formatVersion
) {
    public record SchemaInfo(
            int schemaId,
            List<ColumnInfo> columns
    ) {}

    public record ColumnInfo(
            int id,
            String name,
            String type,
            boolean required,
            String doc
    ) {}

    public record PartitionFieldInfo(
            String sourceColumn,
            int sourceId,
            String transform,
            String name
    ) {}
}
