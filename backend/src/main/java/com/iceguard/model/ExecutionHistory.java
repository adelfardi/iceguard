package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
@Table(name = "execution_history")
public class ExecutionHistory extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    public MaintenanceSchedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_id", nullable = false)
    @NotNull
    public CatalogConfig catalog;

    @NotBlank
    @Column(nullable = false, length = 512)
    public String namespace;

    @NotBlank
    @Column(name = "table_name", nullable = false, length = 512)
    public String tableName;

    @NotBlank
    @Column(name = "action_type", nullable = false, length = 100)
    public String actionType;

    @NotNull
    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    public ExecutionStatus status;

    @Column(name = "started_at", nullable = false)
    public Instant startedAt;

    @Column(name = "finished_at")
    public Instant finishedAt;

    @Column(columnDefinition = "text")
    public String result = "{}";

    @Column(name = "error_message", columnDefinition = "text")
    public String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        if (startedAt == null) startedAt = Instant.now();
    }

    public enum ExecutionStatus {
        PENDING, RUNNING, SUCCESS, FAILED, CANCELLED
    }
}
