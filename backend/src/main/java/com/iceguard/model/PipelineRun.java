package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
@Table(name = "pipeline_run")
public class PipelineRun extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pipeline_id", nullable = false)
    @NotNull
    public Pipeline pipeline;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    public RunStatus status;

    @Column(name = "triggered_by", length = 50)
    public String triggeredBy;

    @Column(name = "started_at")
    public Instant startedAt;

    @Column(name = "finished_at")
    public Instant finishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public enum RunStatus {
        PENDING, RUNNING, SUCCESS, FAILED, CANCELLED
    }
}
