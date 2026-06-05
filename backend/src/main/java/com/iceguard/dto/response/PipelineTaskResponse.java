package com.iceguard.dto.response;

import java.util.Map;

public record PipelineTaskResponse(
        Long id,
        int orderIndex,
        String name,
        String actionType,
        Map<String, String> parameters
) {}
