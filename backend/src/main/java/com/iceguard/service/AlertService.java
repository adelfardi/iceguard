package com.iceguard.service;

import com.iceguard.dto.request.CreateAlertRuleRequest;
import com.iceguard.dto.request.UpdateAlertRuleRequest;
import com.iceguard.dto.response.AlertEventResponse;
import com.iceguard.dto.response.AlertRuleResponse;
import com.iceguard.dto.response.TableStatisticsResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.model.AlertEvent;
import com.iceguard.model.AlertRule;
import com.iceguard.model.CatalogConfig;
import com.iceguard.repository.AlertEventRepository;
import com.iceguard.repository.AlertRuleRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@ApplicationScoped
public class AlertService {

    private static final Logger LOG = Logger.getLogger(AlertService.class);

    @Inject
    AlertRuleRepository ruleRepository;

    @Inject
    AlertEventRepository eventRepository;

    @Inject
    CatalogService catalogService;

    @Inject
    TableService tableService;

    @Inject
    EmailService emailService;

    // --- Rule CRUD ---

    public List<AlertRuleResponse> listRules() {
        return ruleRepository.listAll().stream()
                .map(this::toRuleResponse)
                .toList();
    }

    public AlertRuleResponse getRule(Long id) {
        return toRuleResponse(findRuleOrThrow(id));
    }

    @Transactional
    public AlertRuleResponse createRule(CreateAlertRuleRequest request) {
        CatalogConfig catalog = catalogService.findOrThrow(request.catalogId());

        AlertRule rule = new AlertRule();
        rule.name = request.name();
        rule.catalog = catalog;
        rule.namespace = request.namespace();
        rule.tableName = request.tableName();
        rule.metric = request.metric();
        rule.operator = request.operator();
        rule.threshold = request.threshold();
        rule.checkIntervalMinutes = request.checkIntervalMinutes();
        rule.emails = String.join(",", request.emails());
        rule.enabled = request.enabled();
        ruleRepository.persist(rule);

        return toRuleResponse(rule);
    }

    @Transactional
    public AlertRuleResponse updateRule(Long id, UpdateAlertRuleRequest request) {
        AlertRule rule = findRuleOrThrow(id);
        CatalogConfig catalog = catalogService.findOrThrow(request.catalogId());

        rule.name = request.name();
        rule.catalog = catalog;
        rule.namespace = request.namespace();
        rule.tableName = request.tableName();
        rule.metric = request.metric();
        rule.operator = request.operator();
        rule.threshold = request.threshold();
        rule.checkIntervalMinutes = request.checkIntervalMinutes();
        rule.emails = String.join(",", request.emails());
        rule.enabled = request.enabled();

        return toRuleResponse(rule);
    }

    @Transactional
    public void deleteRule(Long id) {
        AlertRule rule = findRuleOrThrow(id);

        // Delete associated events first
        List<AlertEvent> events = eventRepository.findByRuleId(id);
        for (AlertEvent event : events) {
            eventRepository.delete(event);
        }

        ruleRepository.delete(rule);
    }

    @Transactional
    public AlertRuleResponse toggleRule(Long id, boolean enabled) {
        AlertRule rule = findRuleOrThrow(id);
        rule.enabled = enabled;
        return toRuleResponse(rule);
    }

    // --- Event operations ---

    public List<AlertEventResponse> listEvents(int limit) {
        return eventRepository.findRecent(limit).stream()
                .map(this::toEventResponse)
                .toList();
    }

    public List<AlertEventResponse> listEventsByRule(Long ruleId) {
        return eventRepository.findByRuleId(ruleId).stream()
                .map(this::toEventResponse)
                .toList();
    }

    @Transactional
    public AlertEventResponse acknowledgeEvent(Long id) {
        AlertEvent event = eventRepository.findById(id);
        if (event == null) {
            throw new ResourceNotFoundException("Alert event not found: " + id);
        }
        event.status = "ACKNOWLEDGED";
        return toEventResponse(event);
    }

    // --- Rule checking ---

    @Transactional
    public void checkRule(AlertRule rule) {
        try {
            TableStatisticsResponse stats = tableService.getStatistics(
                    rule.catalog.id, rule.namespace, rule.tableName);

            double currentValue = switch (rule.metric) {
                case "SNAPSHOT_COUNT" -> stats.snapshotCount();
                case "DATA_FILE_COUNT" -> stats.totalDataFiles();
                case "TOTAL_SIZE_BYTES" -> stats.totalDataSizeBytes();
                case "DELETE_FILE_COUNT" -> stats.totalDeleteFiles();
                case "TOTAL_RECORDS" -> stats.totalRecords();
                default -> 0;
            };

            boolean triggered = switch (rule.operator) {
                case "GT" -> currentValue > rule.threshold;
                case "LT" -> currentValue < rule.threshold;
                case "GTE" -> currentValue >= rule.threshold;
                case "LTE" -> currentValue <= rule.threshold;
                case "EQ" -> currentValue == rule.threshold;
                default -> false;
            };

            rule.lastCheckedAt = Instant.now();
            rule.lastValue = currentValue;
            rule.lastStatus = triggered ? "TRIGGERED" : "OK";

            if (triggered) {
                String tableRef = rule.catalog.name + "/" + rule.namespace + "/" + rule.tableName;

                AlertEvent event = new AlertEvent();
                event.rule = rule;
                event.metric = rule.metric;
                event.currentValue = currentValue;
                event.threshold = rule.threshold;
                event.operator = rule.operator;
                event.tableRef = tableRef;
                event.ruleName = rule.name;
                event.status = "TRIGGERED";
                eventRepository.persist(event);

                // Send notification
                List<String> recipients = parseEmails(rule.emails);
                if (!recipients.isEmpty()) {
                    emailService.sendAlertNotification(rule, event, recipients);
                    event.notified = true;
                }

                LOG.infof("Alert TRIGGERED: rule '%s', metric %s = %.2f (threshold: %.2f %s) on %s",
                        rule.name, rule.metric, currentValue, rule.threshold, rule.operator, tableRef);
            } else {
                LOG.debugf("Alert OK: rule '%s', metric %s = %.2f (threshold: %.2f %s)",
                        rule.name, rule.metric, currentValue, rule.threshold, rule.operator);
            }
        } catch (Exception e) {
            LOG.errorf(e, "Failed to check alert rule '%s' (id=%d)", rule.name, rule.id);
            rule.lastCheckedAt = Instant.now();
            rule.lastStatus = "ERROR";
        }
    }

    // --- Helpers ---

    private AlertRule findRuleOrThrow(Long id) {
        return ruleRepository.findByIdOptional(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert rule not found: " + id));
    }

    private List<String> parseEmails(String emails) {
        if (emails == null || emails.isBlank()) {
            return List.of();
        }
        return Arrays.stream(emails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private AlertRuleResponse toRuleResponse(AlertRule rule) {
        return new AlertRuleResponse(
                rule.id,
                rule.name,
                rule.catalog != null ? rule.catalog.id : null,
                rule.catalog != null ? rule.catalog.name : null,
                rule.namespace,
                rule.tableName,
                rule.metric,
                rule.operator,
                rule.threshold,
                rule.checkIntervalMinutes,
                parseEmails(rule.emails),
                rule.enabled,
                rule.lastCheckedAt,
                rule.lastValue,
                rule.lastStatus,
                rule.createdAt
        );
    }

    private AlertEventResponse toEventResponse(AlertEvent event) {
        return new AlertEventResponse(
                event.id,
                event.rule != null ? event.rule.id : null,
                event.ruleName,
                event.metric,
                event.currentValue,
                event.threshold,
                event.operator,
                event.tableRef,
                event.status,
                event.notified,
                event.triggeredAt,
                event.resolvedAt
        );
    }
}
