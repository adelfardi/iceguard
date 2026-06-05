package com.iceguard.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "smtp_config")
public class SmtpConfig extends PanacheEntity {

    public String host;

    public int port = 587;

    public String username;

    @Column(columnDefinition = "text")
    public String password;

    @Column(name = "from_address")
    public String fromAddress;

    public boolean tls = true;

    public boolean enabled = false;

    @Column(name = "updated_at")
    public Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
