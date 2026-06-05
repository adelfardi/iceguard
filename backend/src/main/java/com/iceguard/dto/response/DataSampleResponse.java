package com.iceguard.dto.response;

import java.util.List;
import java.util.Map;

public record DataSampleResponse(
        List<String> columns,
        List<Map<String, Object>> rows,
        int rowCount,
        boolean hasMore
) {}
