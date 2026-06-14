package com.iceguard.dto.response;

import java.time.Instant;

public record StorageHealthThresholdsResponse(
        int avgVsTargetWarnPercent,
        int avgVsTargetBadPercent,
        int smallFileSizeKb,
        int smallFilesWarnPercent,
        int smallFilesBadPercent,
        int deleteRatioWarnPercent,
        int deleteRatioBadPercent,
        int compactionTargetRatioPercent,
        boolean avgVsTargetEnabled,
        boolean smallFilesEnabled,
        boolean deleteRatioEnabled,
        boolean compactionEnabled,
        int dataFilesThreshold,
        int snapshotCountThreshold,
        Instant updatedAt
) {}
