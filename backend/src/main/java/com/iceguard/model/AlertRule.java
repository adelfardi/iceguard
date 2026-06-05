package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "alert_rule")
public class AlertRule extends PanacheEntity {

    @NotBlank
    public String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_id")
    public CatalogConfig catalog;

    public String namespace;

    @Column(name = "table_name")
    public String tableName;

    @NotBlank
    public String metric; // SNAPSHOT_COUNT, DATA_FILE_COUNT, TOTAL_SIZE_BYTES, DELETE_FILE_COUNT, TOTAL_RECORDS

    @NotBlank
    public String operator; // GT, LT, GTE, LTE, EQ

    public double threshold;

    @Column(name = "check_interval_minutes")
    public int checkIntervalMinutes = 60;

    @Column(columnDefinition = "text")
    public String emails; // comma-separated

    public boolean enabled = true;

    @Column(name = "last_checked_at")
    public Instant lastCheckedAt;

    @Column(name = "last_value")
    public Double lastValue;

    @Column(name = "last_status")
    public String lastStatus; // OK, TRIGGERED

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
