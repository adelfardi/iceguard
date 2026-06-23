package com.iceguard.dto.response;

/**
 * Write-activity profile derived purely from the table's available snapshots (commit timestamps),
 * to surface quiet ("off-peak") hours for scheduling maintenance.
 */
public record CommitActivityResponse(
        /** Commit counts per hour-of-day (index 0..23), in UTC. */
        int[] hourlyUtc,
        long totalCommits,
        /** Hour-of-day (UTC) with the fewest commits, or null when there's no data. */
        Integer quietestHourUtc,
        /** Start hour (UTC) of the lowest-activity contiguous window of {@code suggestedWindowHours}. */
        Integer suggestedWindowStartUtc,
        int suggestedWindowHours,
        /** False when too few commits to draw a reliable conclusion. */
        boolean enoughData
) {}
