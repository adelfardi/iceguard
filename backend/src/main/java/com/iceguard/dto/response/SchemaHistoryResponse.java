package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.time.Instant;
import java.util.List;

/** Chronological history of a table's schema versions, with the diff introduced by each. */
public record SchemaHistoryResponse(
        String namespace,
        String tableName,
        int currentSchemaId,
        List<SchemaVersion> versions
) {
    public record SchemaVersion(
            int schemaId,
            @JsonSerialize(using = ToStringSerializer.class) Long snapshotId, // first snapshot that used this schema (nullable)
            Instant timestamp,      // when it first became active (nullable)
            int columnCount,
            List<SchemaDiff.ColumnRef> columns,
            SchemaDiff diff,        // change vs previous version (null for the first)
            boolean current
    ) {}
}
