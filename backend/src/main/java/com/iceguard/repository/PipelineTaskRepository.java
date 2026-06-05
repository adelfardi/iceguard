package com.iceguard.repository;

import com.iceguard.model.PipelineTask;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class PipelineTaskRepository implements PanacheRepository<PipelineTask> {

    public List<PipelineTask> findByPipelineId(Long pipelineId) {
        return list("pipeline.id", Sort.by("orderIndex").ascending(), pipelineId);
    }
}
