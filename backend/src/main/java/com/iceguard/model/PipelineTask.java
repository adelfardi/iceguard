package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
@Table(name = "pipeline_task")
public class PipelineTask extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pipeline_id", nullable = false)
    @NotNull
    public Pipeline pipeline;

    @Column(name = "order_index", nullable = false)
    public int orderIndex;

    @NotBlank
    @Column(nullable = false)
    public String name;

    @NotBlank
    @Column(name = "action_type", length = 100, nullable = false)
    public String actionType;

    @Column(columnDefinition = "text")
    public String parameters = "{}";

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
