package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateScheduleRequest(
        @NotNull Long catalogId,
        String namespace,
        String tableName,
        @NotBlank String actionType,
        @NotBlank String cronExpression,
        Map<String, String> parameters,
        boolean enabled
) {
    public CreateScheduleRequest {
        if (parameters == null) parameters = Map.of();
    }
}
