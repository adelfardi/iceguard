package com.iceguard.dto.response;

import java.time.Instant;

/**
 * One Nessie commit that touched a given table, reconstructed from Nessie's
 * native commit log (Nessie returns only a single Iceberg snapshot per table,
 * so the real history lives in its git-like commit log).
 */
public record NessieCommitResponse(
        String hash,
        String message,
        String author,
        Instant committedAt,
        String operation,        // PUT or DELETE
        Long snapshotId,         // Iceberg snapshot id at that commit (nullable)
        String metadataLocation  // metadata.json location at that commit (nullable)
) {}
