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

    /** Catalog implementation. Persisted so behaviour (e.g. Nessie commit-log history)
     *  is driven by this, not re-guessed from the name/URI on every request. */
    @Column(length = 50)
    @Enumerated(EnumType.STRING)
    public Vendor vendor = Vendor.REST;

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

    public enum Vendor {
        REST, NESSIE, POLARIS, UNITY, OTHER
    }

    /** Best-effort fallback when a caller doesn't specify the vendor (and for backfilling
     *  legacy rows): mirror the old name/URI heuristic. */
    public static Vendor inferVendor(String name, String uri) {
        String s = ((name == null ? "" : name) + " " + (uri == null ? "" : uri)).toLowerCase();
        if (s.contains("nessie")) return Vendor.NESSIE;
        if (s.contains("polaris")) return Vendor.POLARIS;
        if (s.contains("unity")) return Vendor.UNITY;
        return Vendor.REST;
    }
}
