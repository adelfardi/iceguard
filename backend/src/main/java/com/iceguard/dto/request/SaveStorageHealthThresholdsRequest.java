package com.iceguard.dto.request;

public record SaveStorageHealthThresholdsRequest(
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
        boolean compactionEnabled
) {}
