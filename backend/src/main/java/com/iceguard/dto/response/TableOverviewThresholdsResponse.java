package com.iceguard.dto.response;

/**
 * Effective Overview gauge thresholds for one table. The {@code *Override} fields carry the
 * raw per-table value (null = inherited), while the {@code global*} fields expose the default
 * so the UI can show what "inherit" resolves to.
 */
public record TableOverviewThresholdsResponse(
        int dataFilesThreshold,
        int snapshotCountThreshold,
        Integer dataFilesThresholdOverride,
        Integer snapshotCountThresholdOverride,
        int globalDataFilesThreshold,
        int globalSnapshotCountThreshold
) {}
