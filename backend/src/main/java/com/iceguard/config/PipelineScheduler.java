package com.iceguard.config;

import com.iceguard.model.Pipeline;
import com.iceguard.model.PipelineRun;
import com.iceguard.repository.PipelineRepository;
import com.iceguard.repository.PipelineRunRepository;
import com.iceguard.service.PipelineService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

@ApplicationScoped
public class PipelineScheduler {

    private static final Logger LOG = Logger.getLogger(PipelineScheduler.class);

    @Inject
    PipelineRepository pipelineRepository;

    @Inject
    PipelineRunRepository runRepository;

    @Inject
    PipelineService pipelineService;

    @Scheduled(every = "30s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void checkPipelines() {
        List<Pipeline> pipelines = pipelineRepository.listAll();
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);

        for (Pipeline pipeline : pipelines) {
            if (!pipeline.enabled || pipeline.cronExpression == null || pipeline.cronExpression.isBlank()) {
                continue;
            }
            try {
                if (matchesCron(pipeline.cronExpression.trim(), now)) {
                    Instant oneMinuteAgo = now.minusMinutes(1).toInstant();
                    List<PipelineRun> recentRuns = runRepository.findByPipelineId(pipeline.id);
                    boolean alreadyRanThisMinute = recentRuns.stream()
                            .anyMatch(r -> r.startedAt != null && r.startedAt.isAfter(oneMinuteAgo)
                                    && "schedule".equals(r.triggeredBy));
                    if (alreadyRanThisMinute) continue;

                    LOG.infof("Triggering pipeline '%s' (id=%d) by cron: %s",
                            pipeline.name, pipeline.id, pipeline.cronExpression);
                    pipelineService.triggerScheduled(pipeline.id);
                }
            } catch (Exception e) {
                LOG.errorf(e, "Failed to trigger pipeline '%s' (id=%d)", pipeline.name, pipeline.id);
            }
        }
    }

    static boolean matchesCron(String cron, ZonedDateTime now) {
        String[] parts = cron.split("\\s+");
        if (parts.length < 5) return false;

        int minute = now.getMinute();
        int hour = now.getHour();
        int dayOfMonth = now.getDayOfMonth();
        int month = now.getMonthValue();
        int dayOfWeek = now.getDayOfWeek().getValue() % 7;

        return matchesField(parts[0], minute, 0, 59)
                && matchesField(parts[1], hour, 0, 23)
                && matchesField(parts[2], dayOfMonth, 1, 31)
                && matchesField(parts[3], month, 1, 12)
                && matchesField(parts[4], dayOfWeek, 0, 6);
    }

    static boolean matchesField(String field, int value, int min, int max) {
        if ("*".equals(field)) return true;

        for (String part : field.split(",")) {
            if (part.contains("/")) {
                String[] stepParts = part.split("/");
                int step = Integer.parseInt(stepParts[1]);
                String base = stepParts[0];
                int start = "*".equals(base) ? min : Integer.parseInt(base);
                for (int i = start; i <= max; i += step) {
                    if (i == value) return true;
                }
            } else if (part.contains("-")) {
                String[] range = part.split("-");
                int lo = Integer.parseInt(range[0]);
                int hi = Integer.parseInt(range[1]);
                if (value >= lo && value <= hi) return true;
            } else {
                if (Integer.parseInt(part) == value) return true;
            }
        }
        return false;
    }
}
