package com.iceguard.dto.response;

import java.util.Map;

public record SparkSettingsResponse(
        String driverMemory,
        String executorMemory,
        Integer executorCores,
        Integer executorInstances,
        Map<String, String> extraConf
) {}
