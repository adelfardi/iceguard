package com.iceguard.dto.response;

import com.iceguard.model.PipelineTaskRun.RunStatus;
import java.time.Instant;
import java.util.Map;

public record PipelineTaskRunResponse(
        Long id,
        Long taskId,
        String taskName,
        String actionType,
        int orderIndex,
        RunStatus status,
        Instant startedAt,
        Instant finishedAt,
        Map<String, Object> result,
        String errorMessage
) {}
