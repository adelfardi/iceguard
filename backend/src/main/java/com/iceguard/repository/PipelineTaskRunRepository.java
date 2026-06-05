package com.iceguard.repository;

import com.iceguard.model.PipelineTaskRun;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class PipelineTaskRunRepository implements PanacheRepository<PipelineTaskRun> {

    public List<PipelineTaskRun> findByRunId(Long runId) {
        return list("run.id", Sort.by("orderIndex").ascending(), runId);
    }
}
