package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
@Table(name = "maintenance_schedule")
public class MaintenanceSchedule extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_id", nullable = false)
    @NotNull
    public CatalogConfig catalog;

    @Column(length = 512)
    public String namespace;

    @Column(name = "table_name", length = 512)
    public String tableName;

    @NotBlank
    @Column(name = "action_type", length = 100, nullable = false)
    public String actionType;

    @NotBlank
    @Column(name = "cron_expression", length = 100, nullable = false)
    public String cronExpression;

    @Column(columnDefinition = "text")
    public String parameters = "{}";

    @Column(nullable = false)
    public boolean enabled = true;

    @Column(name = "next_run")
    public Instant nextRun;

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
