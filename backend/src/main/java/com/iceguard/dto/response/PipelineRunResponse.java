package com.iceguard.dto.response;

import com.iceguard.model.PipelineRun.RunStatus;
import java.time.Instant;
import java.util.List;

public record PipelineRunResponse(
        Long id,
        Long pipelineId,
        String pipelineName,
        RunStatus status,
        String triggeredBy,
        Instant startedAt,
        Instant finishedAt,
        List<PipelineTaskRunResponse> taskRuns,
        Instant createdAt
) {}
