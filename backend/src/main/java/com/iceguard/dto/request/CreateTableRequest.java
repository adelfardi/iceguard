package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;

public record CreateTableRequest(
        @NotBlank String name,
        @NotEmpty List<ColumnDef> columns,
        List<PartitionFieldDef> partitionFields,
        Map<String, String> properties
) {
    public record ColumnDef(
            @NotBlank String name,
            @NotBlank String type,
            boolean required,
            String doc
    ) {}

    public record PartitionFieldDef(
            @NotBlank String sourceColumn,
            @NotBlank String transform
    ) {}
}
