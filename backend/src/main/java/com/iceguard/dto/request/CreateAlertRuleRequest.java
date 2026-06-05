package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateAlertRuleRequest(
        @NotBlank String name,
        @NotNull Long catalogId,
        String namespace,
        String tableName,
        @NotBlank String metric,
        @NotBlank String operator,
        double threshold,
        int checkIntervalMinutes,
        List<String> emails,
        boolean enabled
) {
    public CreateAlertRuleRequest {
        if (emails == null) emails = List.of();
        if (checkIntervalMinutes <= 0) checkIntervalMinutes = 60;
    }
}
