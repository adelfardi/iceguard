package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "catalog_config")
public class CatalogConfig extends PanacheEntity {

    @NotBlank
    @Column(nullable = false, unique = true)
    public String name;

    @NotBlank
    @Column(nullable = false, length = 1024)
    public String uri;

    @Column(length = 1024)
    public String warehouse;

    @Column(columnDefinition = "text")
    public String properties = "{}";

    @Column(name = "auth_type", length = 50)
    @Enumerated(EnumType.STRING)
    public AuthType authType = AuthType.NONE;

    @Column(columnDefinition = "text")
    public String credentials = "{}";

    /** JSON array of free-form labels, e.g. ["prod","draft"]. */
    @Column(columnDefinition = "text")
    public String tags = "[]";

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

    public enum AuthType {
        NONE, BEARER, OAUTH2, BASIC
    }
}
