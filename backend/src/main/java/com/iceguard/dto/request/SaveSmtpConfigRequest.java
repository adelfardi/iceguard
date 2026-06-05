package com.iceguard.dto.request;

public record SaveSmtpConfigRequest(
        String host,
        int port,
        String username,
        String password,
        String fromAddress,
        boolean tls,
        boolean enabled
) {}
