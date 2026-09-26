package com.iceguard.dto.response;

/** A catalog-level Nessie reference (branch or tag) — distinct from the table's own Iceberg refs. */
public record NessieReferenceResponse(
        String name,
        String type,  // BRANCH or TAG
        String hash
) {}
