package com.iceguard.dto.response;

import java.time.Instant;

public record SmtpConfigResponse(
        Long id,
        String host,
        int port,
        String username,
        String fromAddress,
        boolean tls,
        boolean enabled,
        Instant updatedAt
) {}
