package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Per-table override of the two Overview gauge thresholds. A null column inherits the
 * global {@link StorageHealthThresholds} default; the row is deleted when both are null.
 */
@Entity
@Table(name = "table_overview_thresholds",
        uniqueConstraints = @UniqueConstraint(columnNames = {"catalog_id", "namespace", "table_name"}))
public class TableOverviewThresholds extends PanacheEntity {

    @Column(name = "catalog_id", nullable = false)
    public Long catalogId;

    @Column(name = "namespace", nullable = false)
    public String namespace;

    @Column(name = "table_name", nullable = false)
    public String tableName;

    /** Null = inherit the global default. */
    @Column(name = "data_files_threshold")
    public Integer dataFilesThreshold;

    /** Null = inherit the global default. */
    @Column(name = "snapshot_count_threshold")
    public Integer snapshotCountThreshold;

    @Column(name = "updated_at")
    public Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
