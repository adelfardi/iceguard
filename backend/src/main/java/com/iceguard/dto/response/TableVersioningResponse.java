package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.util.List;

/**
 * Versioning state of a table: its Iceberg refs plus the snapshot DAG they point into. For Nessie
 * catalogs it also carries the catalog-level references and the one this catalog is bound to.
 */
public record TableVersioningResponse(
        @JsonSerialize(using = ToStringSerializer.class) Long currentSnapshotId,
        List<TableRefResponse> refs,
        List<SnapshotResponse> snapshots,
        String nessieRef,                          // null unless Nessie
        List<NessieReferenceResponse> nessieReferences // empty unless Nessie
) {}
