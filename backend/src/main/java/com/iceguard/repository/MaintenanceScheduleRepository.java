package com.iceguard.repository;

import com.iceguard.model.MaintenanceSchedule;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class MaintenanceScheduleRepository implements PanacheRepository<MaintenanceSchedule> {

    public List<MaintenanceSchedule> findByCatalogId(Long catalogId) {
        return list("catalog.id", catalogId);
    }

    public List<MaintenanceSchedule> findEnabled() {
        return list("enabled", true);
    }
}
