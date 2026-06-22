package com.iceguard.dto.request;

import java.util.Map;

public record SaveSparkSettingsRequest(
        String driverMemory,
        String executorMemory,
        Integer executorCores,
        Integer executorInstances,
        Map<String, String> extraConf
) {}
