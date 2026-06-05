package com.iceguard.dto.response;

import java.util.Map;

public record NamespaceResponse(
        String name,
        Map<String, String> properties
) {}
