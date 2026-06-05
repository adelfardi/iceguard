package com.iceguard.repository;

import com.iceguard.model.SmtpConfig;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class SmtpConfigRepository implements PanacheRepository<SmtpConfig> {

    public Optional<SmtpConfig> findFirst() {
        return findAll().firstResultOptional();
    }
}
