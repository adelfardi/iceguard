package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "storage_health_thresholds")
public class StorageHealthThresholds extends PanacheEntity {

    @Column(name = "avg_vs_target_warn_percent")
    public int avgVsTargetWarnPercent = 90;

    @Column(name = "avg_vs_target_bad_percent")
    public int avgVsTargetBadPercent = 50;

    @Column(name = "small_file_size_kb")
    public int smallFileSizeKb = 8192;

    @Column(name = "small_files_warn_percent")
    public int smallFilesWarnPercent = 20;

    @Column(name = "small_files_bad_percent")
    public int smallFilesBadPercent = 50;

    @Column(name = "delete_ratio_warn_percent")
    public int deleteRatioWarnPercent = 10;

    @Column(name = "delete_ratio_bad_percent")
    public int deleteRatioBadPercent = 30;

    @Column(name = "compaction_target_ratio_percent")
    public int compactionTargetRatioPercent = 50;

    @Column(name = "avg_vs_target_enabled")
    public boolean avgVsTargetEnabled = true;

    @Column(name = "small_files_enabled")
    public boolean smallFilesEnabled = true;

    @Column(name = "delete_ratio_enabled")
    public boolean deleteRatioEnabled = true;

    @Column(name = "compaction_enabled")
    public boolean compactionEnabled = true;

    @Column(name = "data_files_threshold")
    public int dataFilesThreshold = 100;

    @Column(name = "snapshot_count_threshold")
    public int snapshotCountThreshold = 50;

    @Column(name = "updated_at")
    public Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
