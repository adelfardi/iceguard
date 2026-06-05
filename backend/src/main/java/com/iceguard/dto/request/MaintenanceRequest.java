package com.iceguard.dto.request;

import java.util.Map;

public record MaintenanceRequest(
        Long olderThanMs,
        Integer retainLast,
        Long snapshotId,
        Map<String, String> parameters,
        /** Execution engine: "java" (default, analyse only) or "spark". */
        String engine,
        /** Spark cluster id to run on; null with engine="spark" means local Spark (local[*]). */
        Long sparkClusterId
) {}
