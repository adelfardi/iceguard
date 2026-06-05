package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record PartitionSpecUpdateRequest(
        List<PartitionFieldDef> addFields,
        List<String> removeFields
) {
    public record PartitionFieldDef(
            @NotBlank String sourceColumn,
            @NotBlank String transform,
            String name
    ) {}
}
