package com.iceguard.repository;

import com.iceguard.model.PipelineRun;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class PipelineRunRepository implements PanacheRepository<PipelineRun> {

    public List<PipelineRun> findByPipelineId(Long pipelineId) {
        return list("pipeline.id", Sort.by("startedAt").descending(), pipelineId);
    }

    public List<PipelineRun> findRecent(int limit) {
        return findAll(Sort.by("createdAt").descending()).page(0, limit).list();
    }
}
