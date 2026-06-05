package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
@Table(name = "pipeline_task_run")
public class PipelineTaskRun extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id", nullable = false)
    @NotNull
    public PipelineRun run;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @NotNull
    public PipelineTask task;

    @Column(name = "order_index", nullable = false)
    public int orderIndex;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    public RunStatus status;

    @Column(name = "started_at")
    public Instant startedAt;

    @Column(name = "finished_at")
    public Instant finishedAt;

    @Column(columnDefinition = "text")
    public String result = "{}";

    @Column(name = "error_message", columnDefinition = "text")
    public String errorMessage;

    public enum RunStatus {
        PENDING, RUNNING, SUCCESS, FAILED, SKIPPED
    }
}
