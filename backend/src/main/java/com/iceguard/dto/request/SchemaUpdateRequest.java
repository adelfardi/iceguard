package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record SchemaUpdateRequest(
        List<AddColumn> addColumns,
        List<String> dropColumns,
        List<RenameColumn> renameColumns,
        List<UpdateColumn> updateColumns
) {
    public record AddColumn(
            @NotBlank String name,
            @NotBlank String type,
            boolean required,
            String doc,
            String afterColumn
    ) {}

    public record RenameColumn(
            @NotBlank String oldName,
            @NotBlank String newName
    ) {}

    public record UpdateColumn(
            @NotBlank String name,
            String newType,
            String doc,
            Boolean required
    ) {}
}
