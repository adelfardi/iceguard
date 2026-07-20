package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

/**
 * A widget pinned to the dashboard. Renders live data by re-fetching from the referenced
 * table (or globally). {@code widgetType} keys into the frontend widget registry; {@code params}
 * carries any widget-specific config (e.g. the storage window in hours) as JSON.
 */
@Entity
@Table(name = "dashboard_widget")
public class DashboardWidget extends PanacheEntity {

    @NotBlank
    @Column(nullable = false)
    public String title;

    @NotBlank
    @Column(name = "widget_type", nullable = false, length = 64)
    public String widgetType;

    /** Table scope (nullable for global widgets). */
    @Column(name = "catalog_id")
    public Long catalogId;

    @Column(length = 512)
    public String namespace;

    @Column(name = "table_name", length = 512)
    public String tableName;

    /** Widget-specific config as JSON. */
    @Column(columnDefinition = "text")
    public String params = "{}";

    @Column(name = "order_index", nullable = false)
    public int orderIndex = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
