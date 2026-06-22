package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.dto.request.CreatePipelineRequest;
import com.iceguard.dto.request.CreatePipelineTaskRequest;
import com.iceguard.dto.request.UpdatePipelineRequest;
import com.iceguard.dto.response.PipelineResponse;
import com.iceguard.dto.response.PipelineRunResponse;
import com.iceguard.dto.response.PipelineTaskResponse;
import com.iceguard.dto.response.PipelineTaskRunResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.executor.MaintenanceExecutor;
import com.iceguard.executor.MaintenanceExecutor.ExecutorContext;
import com.iceguard.executor.MaintenanceExecutor.MaintenanceResult;
import com.iceguard.model.*;
import com.iceguard.model.PipelineRun.RunStatus;
import com.iceguard.repository.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class PipelineService {

    private static final Logger LOG = Logger.getLogger(PipelineService.class);

    @Inject
    PipelineRepository pipelineRepository;

    @Inject
    PipelineTaskRepository taskRepository;

    @Inject
    PipelineRunRepository runRepository;

    @Inject
    PipelineTaskRunRepository taskRunRepository;

    @Inject
    CatalogService catalogService;

    @Inject
    MaintenanceExecutor executor;

    @Inject
    MaintenanceService maintenanceService;

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    @Inject
    ObjectMapper objectMapper;

    public List<PipelineResponse> listAll() {
        return pipelineRepository.listAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public PipelineResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional
    public PipelineResponse create(CreatePipelineRequest request) {
        CatalogConfig catalog = catalogService.findOrThrow(request.catalogId());

        Pipeline pipeline = new Pipeline();
        pipeline.name = request.name();
        pipeline.description = request.description();
        pipeline.catalog = catalog;
        pipeline.namespace = request.namespace();
        pipeline.tableName = request.tableName();
        pipeline.cronExpression = request.cronExpression();
        pipeline.enabled = request.enabled();
        pipelineRepository.persist(pipeline);

        for (int i = 0; i < request.tasks().size(); i++) {
            CreatePipelineTaskRequest taskReq = request.tasks().get(i);
            PipelineTask task = new PipelineTask();
            task.pipeline = pipeline;
            task.orderIndex = i;
            task.name = taskReq.name();
            task.actionType = taskReq.actionType();
            try {
                task.parameters = objectMapper.writeValueAsString(taskReq.parameters());
            } catch (Exception e) {
                task.parameters = "{}";
            }
            taskRepository.persist(task);
        }

        return toResponse(pipeline);
    }

    @Transactional
    public PipelineResponse update(Long id, UpdatePipelineRequest request) {
        Pipeline pipeline = findOrThrow(id);
        CatalogConfig catalog = catalogService.findOrThrow(request.catalogId());

        pipeline.name = request.name();
        pipeline.description = request.description();
        pipeline.catalog = catalog;
        pipeline.namespace = request.namespace();
        pipeline.tableName = request.tableName();
        pipeline.cronExpression = request.cronExpression();
        pipeline.enabled = request.enabled();

        // Delete task runs referencing old tasks, then delete old tasks
        List<PipelineTask> existingTasks = taskRepository.findByPipelineId(id);
        for (PipelineTask t : existingTasks) {
            List<PipelineTaskRun> refs = taskRunRepository.find("task.id", t.id).list();
            for (PipelineTaskRun ref : refs) {
                taskRunRepository.delete(ref);
            }
            taskRepository.delete(t);
        }

        for (int i = 0; i < request.tasks().size(); i++) {
            CreatePipelineTaskRequest taskReq = request.tasks().get(i);
            PipelineTask task = new PipelineTask();
            task.pipeline = pipeline;
            task.orderIndex = i;
            task.name = taskReq.name();
            task.actionType = taskReq.actionType();
            try {
                task.parameters = objectMapper.writeValueAsString(taskReq.parameters());
            } catch (Exception e) {
                task.parameters = "{}";
            }
            taskRepository.persist(task);
        }

        return toResponse(pipeline);
    }

    @Transactional
    public PipelineResponse toggleEnabled(Long id, boolean enabled) {
        Pipeline pipeline = findOrThrow(id);
        pipeline.enabled = enabled;
        return toResponse(pipeline);
    }

    @Transactional
    public void delete(Long id) {
        Pipeline pipeline = findOrThrow(id);

        // Delete task runs for all runs of this pipeline
        List<PipelineRun> runs = runRepository.findByPipelineId(id);
        for (PipelineRun run : runs) {
            List<PipelineTaskRun> taskRuns = taskRunRepository.findByRunId(run.id);
            for (PipelineTaskRun tr : taskRuns) {
                taskRunRepository.delete(tr);
            }
            runRepository.delete(run);
        }

        // Delete tasks
        List<PipelineTask> tasks = taskRepository.findByPipelineId(id);
        for (PipelineTask t : tasks) {
            taskRepository.delete(t);
        }

        pipelineRepository.delete(pipeline);
    }

    @Transactional
    public PipelineRunResponse trigger(Long id) {
        return doTrigger(id, "manual");
    }

    @Transactional
    public PipelineRunResponse triggerScheduled(Long id) {
        return doTrigger(id, "schedule");
    }

    private PipelineRunResponse doTrigger(Long id, String triggeredBy) {
        Pipeline pipeline = findOrThrow(id);
        List<PipelineTask> tasks = taskRepository.findByPipelineId(id);

        if (tasks.isEmpty()) {
            throw new IllegalArgumentException("Pipeline has no tasks to execute");
        }

        // Create the pipeline run
        PipelineRun run = new PipelineRun();
        run.pipeline = pipeline;
        run.status = PipelineRun.RunStatus.PENDING;
        run.triggeredBy = triggeredBy;
        run.createdAt = Instant.now();
        runRepository.persist(run);

        // Create task runs
        for (PipelineTask task : tasks) {
            PipelineTaskRun taskRun = new PipelineTaskRun();
            taskRun.run = run;
            taskRun.task = task;
            taskRun.orderIndex = task.orderIndex;
            taskRun.status = PipelineTaskRun.RunStatus.PENDING;
            taskRunRepository.persist(taskRun);
        }

        // Build executor context
        CatalogConfig config = pipeline.catalog;
        Table table;
        try {
            table = catalogFactory.getOrCreate(config)
                    .loadTable(TableIdentifier.of(Namespace.of(pipeline.namespace), pipeline.tableName));
        } catch (Exception e) {
            LOG.errorf("Failed to load table for pipeline %d: %s", id, e.getMessage());
            run.status = PipelineRun.RunStatus.FAILED;
            run.startedAt = Instant.now();
            run.finishedAt = Instant.now();
            // Mark all task runs as SKIPPED
            List<PipelineTaskRun> taskRuns = taskRunRepository.findByRunId(run.id);
            for (PipelineTaskRun tr : taskRuns) {
                tr.status = PipelineTaskRun.RunStatus.SKIPPED;
                tr.errorMessage = "Pipeline failed to load table: " + e.getMessage();
            }
            return toRunResponse(run);
        }

        ExecutorContext ctx = new ExecutorContext(
                config.name, config.uri, config.warehouse,
                Map.of(), pipeline.namespace, pipeline.tableName, table
        );

        // Execute tasks sequentially
        run.status = PipelineRun.RunStatus.RUNNING;
        run.startedAt = Instant.now();

        boolean pipelineFailed = false;
        List<PipelineTaskRun> taskRuns = taskRunRepository.findByRunId(run.id);

        for (PipelineTaskRun taskRun : taskRuns) {
            if (pipelineFailed) {
                taskRun.status = PipelineTaskRun.RunStatus.SKIPPED;
                continue;
            }

            taskRun.status = PipelineTaskRun.RunStatus.RUNNING;
            taskRun.startedAt = Instant.now();

            try {
                Map<String, String> params = parseParameters(taskRun.task.parameters);
                MaintenanceResult result = executeAction(ctx, config, taskRun.task.actionType, params);

                taskRun.finishedAt = Instant.now();
                if (result.success()) {
                    taskRun.status = PipelineTaskRun.RunStatus.SUCCESS;
                    try {
                        taskRun.result = objectMapper.writeValueAsString(result.details());
                    } catch (Exception e) {
                        taskRun.result = "{}";
                    }
                } else {
                    taskRun.status = PipelineTaskRun.RunStatus.FAILED;
                    taskRun.errorMessage = result.message();
                    pipelineFailed = true;
                }
            } catch (Exception e) {
                taskRun.finishedAt = Instant.now();
                taskRun.status = PipelineTaskRun.RunStatus.FAILED;
                taskRun.errorMessage = e.getMessage();
                pipelineFailed = true;
            }
        }

        run.finishedAt = Instant.now();
        run.status = pipelineFailed ? PipelineRun.RunStatus.FAILED : PipelineRun.RunStatus.SUCCESS;

        return toRunResponse(run);
    }

    public List<PipelineRunResponse> listRuns(Long pipelineId) {
        return runRepository.findByPipelineId(pipelineId).stream()
                .map(this::toRunResponse)
                .toList();
    }

    public PipelineRunResponse getRun(Long runId) {
        PipelineRun run = runRepository.findById(runId);
        if (run == null) {
            throw new ResourceNotFoundException("Pipeline run not found: " + runId);
        }
        return toRunResponse(run);
    }

    public List<PipelineRunResponse> listRecentRuns(int limit) {
        return runRepository.findRecent(limit).stream()
                .map(this::toRunResponse)
                .toList();
    }

    private MaintenanceResult executeAction(ExecutorContext ctx, CatalogConfig catalog, String actionType,
                                             Map<String, String> params) {
        return switch (actionType.toUpperCase()) {
            case "EXPIRE_SNAPSHOTS" -> {
                Long olderThanMs = params.containsKey("olderThanMs")
                        ? Long.parseLong(params.get("olderThanMs")) : null;
                Integer retainLast = params.containsKey("retainLast")
                        ? Integer.parseInt(params.get("retainLast")) : null;
                yield executor.expireSnapshots(ctx, olderThanMs, retainLast);
            }
            case "ROLLBACK" -> {
                if (!params.containsKey("snapshotId")) {
                    yield MaintenanceResult.failure("snapshotId is required for rollback");
                }
                yield executor.rollbackToSnapshot(ctx, Long.parseLong(params.get("snapshotId")));
            }
            case "REWRITE_DATA_FILES" -> maintenanceService.rewriteDataFilesForPipeline(ctx, catalog, params);
            case "REWRITE_POSITION_DELETE_FILES" ->
                    maintenanceService.rewritePositionDeletesForPipeline(ctx, catalog, params);
            case "REWRITE_EQUALITY_DELETE_FILES" ->
                    maintenanceService.rewriteEqualityDeletesForPipeline(ctx, catalog, params);
            case "REWRITE_MANIFESTS" -> executor.rewriteManifests(ctx, params);
            case "REMOVE_ORPHAN_FILES" -> executor.removeOrphanFiles(ctx, params);
            default -> MaintenanceResult.failure("Unknown action type: " + actionType);
        };
    }

    private Map<String, String> parseParameters(String json) {
        if (json == null || json.isBlank() || "{}".equals(json)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Pipeline findOrThrow(Long id) {
        return pipelineRepository.findByIdOptional(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pipeline not found: " + id));
    }

    private PipelineResponse toResponse(Pipeline p) {
        List<PipelineTask> tasks = taskRepository.findByPipelineId(p.id);
        List<PipelineTaskResponse> taskResponses = tasks.stream()
                .map(this::toTaskResponse)
                .toList();

        return new PipelineResponse(
                p.id, p.name, p.description,
                p.catalog.id, p.catalog.name,
                p.namespace, p.tableName,
                p.cronExpression, p.enabled,
                taskResponses,
                p.createdAt, p.updatedAt
        );
    }

    private PipelineTaskResponse toTaskResponse(PipelineTask t) {
        Map<String, String> params = parseParameters(t.parameters);
        return new PipelineTaskResponse(
                t.id, t.orderIndex, t.name,
                t.actionType, params
        );
    }

    @SuppressWarnings("unchecked")
    private PipelineRunResponse toRunResponse(PipelineRun r) {
        List<PipelineTaskRun> taskRuns = taskRunRepository.findByRunId(r.id);
        List<PipelineTaskRunResponse> taskRunResponses = taskRuns.stream()
                .map(this::toTaskRunResponse)
                .toList();

        return new PipelineRunResponse(
                r.id, r.pipeline.id, r.pipeline.name,
                r.status, r.triggeredBy,
                r.startedAt, r.finishedAt,
                taskRunResponses, r.createdAt
        );
    }

    @SuppressWarnings("unchecked")
    private PipelineTaskRunResponse toTaskRunResponse(PipelineTaskRun tr) {
        Map<String, Object> resultMap = Map.of();
        try {
            if (tr.result != null && !tr.result.isBlank()) {
                resultMap = objectMapper.readValue(tr.result, Map.class);
            }
        } catch (Exception ignored) {
        }

        return new PipelineTaskRunResponse(
                tr.id, tr.task.id, tr.task.name,
                tr.task.actionType, tr.orderIndex,
                tr.status, tr.startedAt, tr.finishedAt,
                resultMap, tr.errorMessage
        );
    }
}
