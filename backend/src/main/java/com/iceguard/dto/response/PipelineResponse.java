package com.iceguard.dto.response;

import java.time.Instant;
import java.util.List;

public record PipelineResponse(
        Long id,
        String name,
        String description,
        Long catalogId,
        String catalogName,
        String namespace,
        String tableName,
        String cronExpression,
        boolean enabled,
        List<PipelineTaskResponse> tasks,
        Instant createdAt,
        Instant updatedAt
) {}
