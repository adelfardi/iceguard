package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "alert_event")
public class AlertEvent extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    public AlertRule rule;

    public String metric;

    @Column(name = "current_value")
    public double currentValue;

    public double threshold;

    public String operator;

    @Column(name = "table_ref")
    public String tableRef; // "catalog/namespace/table"

    @Column(name = "rule_name")
    public String ruleName;

    public String status; // TRIGGERED, RESOLVED, ACKNOWLEDGED

    @Column(name = "notified")
    public boolean notified = false;

    @Column(name = "triggered_at")
    public Instant triggeredAt;

    @Column(name = "resolved_at")
    public Instant resolvedAt;

    @Column(name = "created_at")
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        if (triggeredAt == null) {
            triggeredAt = Instant.now();
        }
    }
}
