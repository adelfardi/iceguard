package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record SparkClusterRequest(
        @NotBlank String name,
        @NotBlank String masterUrl,
        String description,
        Map<String, String> properties
) {}
