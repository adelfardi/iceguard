package com.iceguard.config;

import com.iceguard.model.AlertRule;
import com.iceguard.repository.AlertRuleRepository;
import com.iceguard.service.AlertService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class AlertCheckScheduler {

    private static final Logger LOG = Logger.getLogger(AlertCheckScheduler.class);

    @Inject
    AlertRuleRepository ruleRepository;

    @Inject
    AlertService alertService;

    @Scheduled(every = "60s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void checkAlertRules() {
        List<AlertRule> enabledRules = ruleRepository.findEnabled();

        if (enabledRules.isEmpty()) {
            return;
        }

        Instant now = Instant.now();

        for (AlertRule rule : enabledRules) {
            try {
                // Check if enough time has passed since last check
                if (rule.lastCheckedAt != null) {
                    Instant nextCheck = rule.lastCheckedAt.plusSeconds((long) rule.checkIntervalMinutes * 60);
                    if (now.isBefore(nextCheck)) {
                        continue;
                    }
                }

                LOG.debugf("Checking alert rule '%s' (id=%d)", rule.name, rule.id);
                alertService.checkRule(rule);
            } catch (Exception e) {
                LOG.errorf(e, "Error checking alert rule '%s' (id=%d)", rule.name, rule.id);
            }
        }
    }
}
