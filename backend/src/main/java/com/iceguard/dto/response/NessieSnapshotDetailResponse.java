package com.iceguard.dto.response;

import java.util.Map;

/**
 * On-demand details for a single Nessie snapshot/commit, resolved by reading the commit's
 * own metadata.json. {@code available=false} + {@code message} when it can't be recovered
 * (metadata expired/removed, or not a Nessie catalog).
 */
public record NessieSnapshotDetailResponse(
        boolean available,
        String operation,
        Map<String, String> summary,
        String message
) {}
