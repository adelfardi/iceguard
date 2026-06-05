package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "spark_cluster_config")
public class SparkClusterConfig extends PanacheEntity {

    @NotBlank
    @Column(nullable = false, unique = true)
    public String name;

    /** Spark master URL, e.g. "local[*]", "spark://host:7077", "yarn", "k8s://...". */
    @NotBlank
    @Column(name = "master_url", nullable = false, length = 1024)
    public String masterUrl;

    @Column(length = 1024)
    public String description;

    /** Extra Spark configuration as JSON, applied as --conf key=value. */
    @Column(columnDefinition = "text")
    public String properties = "{}";

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
