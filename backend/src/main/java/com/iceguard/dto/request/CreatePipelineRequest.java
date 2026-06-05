package com.iceguard.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreatePipelineRequest(
        @NotBlank String name,
        String description,
        @NotNull Long catalogId,
        String namespace,
        String tableName,
        String cronExpression,
        boolean enabled,
        @Valid List<CreatePipelineTaskRequest> tasks
) {
    public CreatePipelineRequest {
        if (tasks == null) tasks = List.of();
    }
}
