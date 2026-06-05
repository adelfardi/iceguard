package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreateNamespaceRequest(
        @NotBlank String namespace,
        Map<String, String> properties
) {
    public CreateNamespaceRequest {
        if (properties == null) properties = Map.of();
    }
}
