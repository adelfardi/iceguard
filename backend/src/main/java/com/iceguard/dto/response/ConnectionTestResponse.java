package com.iceguard.dto.response;

public record ConnectionTestResponse(
        boolean success,
        String message,
        int namespaceCount
) {}
