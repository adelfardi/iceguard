package com.iceguard.dto.request;

/** A null field clears that override, reverting the gauge to the global default. */
public record SaveTableOverviewThresholdsRequest(
        Integer dataFilesThreshold,
        Integer snapshotCountThreshold
) {}
