package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreatePipelineTaskRequest(
        @NotBlank String name,
        @NotBlank String actionType,
        Map<String, String> parameters
) {
    public CreatePipelineTaskRequest {
        if (parameters == null) parameters = Map.of();
    }
}
