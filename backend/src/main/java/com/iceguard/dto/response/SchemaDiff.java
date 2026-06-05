package com.iceguard.dto.response;

import java.util.List;

/** Column-level difference between two Iceberg schemas (compared by stable field id). */
public record SchemaDiff(
        Integer fromSchemaId,
        Integer toSchemaId,
        List<ColumnRef> added,
        List<ColumnRef> dropped,
        List<ColumnChange> modified,
        int unchanged
) {
    public record ColumnRef(int id, String name, String type, boolean required) {}

    public record ColumnChange(int id, String name, String kind, String detail) {}
}
