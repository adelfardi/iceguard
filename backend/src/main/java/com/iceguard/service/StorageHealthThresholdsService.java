package com.iceguard.service;

import com.iceguard.dto.request.SaveStorageHealthThresholdsRequest;
import com.iceguard.dto.response.StorageHealthThresholdsResponse;
import com.iceguard.exception.CatalogOperationException;
import com.iceguard.model.StorageHealthThresholds;
import com.iceguard.repository.StorageHealthThresholdsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Optional;

@ApplicationScoped
public class StorageHealthThresholdsService {

    @Inject
    StorageHealthThresholdsRepository repository;

    public StorageHealthThresholdsResponse get() {
        return repository.findFirst().map(this::toResponse).orElseGet(this::defaults);
    }

    public StorageHealthThresholdsConfig resolve() {
        StorageHealthThresholdsResponse t = get();
        return new StorageHealthThresholdsConfig(
                t.avgVsTargetWarnPercent(),
                t.avgVsTargetBadPercent(),
                t.smallFileSizeKb(),
                t.smallFilesWarnPercent(),
                t.smallFilesBadPercent(),
                t.deleteRatioWarnPercent(),
                t.deleteRatioBadPercent(),
                t.compactionTargetRatioPercent());
    }

    @Transactional
    public StorageHealthThresholdsResponse save(SaveStorageHealthThresholdsRequest request) {
        validate(request);

        Optional<StorageHealthThresholds> existing = repository.findFirst();
        StorageHealthThresholds config = existing.orElseGet(StorageHealthThresholds::new);

        config.avgVsTargetWarnPercent = request.avgVsTargetWarnPercent();
        config.avgVsTargetBadPercent = request.avgVsTargetBadPercent();
        config.smallFileSizeKb = request.smallFileSizeKb();
        config.smallFilesWarnPercent = request.smallFilesWarnPercent();
        config.smallFilesBadPercent = request.smallFilesBadPercent();
        config.deleteRatioWarnPercent = request.deleteRatioWarnPercent();
        config.deleteRatioBadPercent = request.deleteRatioBadPercent();
        config.compactionTargetRatioPercent = request.compactionTargetRatioPercent();
        config.avgVsTargetEnabled = request.avgVsTargetEnabled();
        config.smallFilesEnabled = request.smallFilesEnabled();
        config.deleteRatioEnabled = request.deleteRatioEnabled();
        config.compactionEnabled = request.compactionEnabled();

        if (existing.isEmpty()) {
            repository.persist(config);
        }

        return toResponse(config);
    }

    private void validate(SaveStorageHealthThresholdsRequest r) {
        // Only enforce a criterion's constraints when it is enabled; a disabled
        // criterion's values are inert, so they should never block a save.
        if (r.smallFilesEnabled() && r.smallFileSizeKb() < 1) {
            throw new CatalogOperationException("Small file size must be at least 1 KB");
        }
        if (r.avgVsTargetEnabled() && r.avgVsTargetBadPercent() >= r.avgVsTargetWarnPercent()) {
            throw new CatalogOperationException("Avg vs target bad threshold must be lower than warn threshold");
        }
        if (r.smallFilesEnabled() && r.smallFilesWarnPercent() >= r.smallFilesBadPercent()) {
            throw new CatalogOperationException("Small files warn threshold must be lower than bad threshold");
        }
        if (r.deleteRatioEnabled() && r.deleteRatioWarnPercent() >= r.deleteRatioBadPercent()) {
            throw new CatalogOperationException("Delete ratio warn threshold must be lower than bad threshold");
        }
        if (r.compactionEnabled() && (r.compactionTargetRatioPercent() < 1 || r.compactionTargetRatioPercent() > 100)) {
            throw new CatalogOperationException("Compaction target ratio must be between 1 and 100");
        }
    }

    private StorageHealthThresholdsResponse defaults() {
        StorageHealthThresholds d = new StorageHealthThresholds();
        return new StorageHealthThresholdsResponse(
                d.avgVsTargetWarnPercent,
                d.avgVsTargetBadPercent,
                d.smallFileSizeKb,
                d.smallFilesWarnPercent,
                d.smallFilesBadPercent,
                d.deleteRatioWarnPercent,
                d.deleteRatioBadPercent,
                d.compactionTargetRatioPercent,
                d.avgVsTargetEnabled,
                d.smallFilesEnabled,
                d.deleteRatioEnabled,
                d.compactionEnabled,
                null);
    }

    private StorageHealthThresholdsResponse toResponse(StorageHealthThresholds config) {
        return new StorageHealthThresholdsResponse(
                config.avgVsTargetWarnPercent,
                config.avgVsTargetBadPercent,
                config.smallFileSizeKb,
                config.smallFilesWarnPercent,
                config.smallFilesBadPercent,
                config.deleteRatioWarnPercent,
                config.deleteRatioBadPercent,
                config.compactionTargetRatioPercent,
                config.avgVsTargetEnabled,
                config.smallFilesEnabled,
                config.deleteRatioEnabled,
                config.compactionEnabled,
                config.updatedAt);
    }

    public record StorageHealthThresholdsConfig(
            int avgVsTargetWarnPercent,
            int avgVsTargetBadPercent,
            int smallFileSizeKb,
            int smallFilesWarnPercent,
            int smallFilesBadPercent,
            int deleteRatioWarnPercent,
            int deleteRatioBadPercent,
            int compactionTargetRatioPercent) {

        public long smallFileSizeBytes() {
            return (long) smallFileSizeKb * 1024;
        }
    }
}
