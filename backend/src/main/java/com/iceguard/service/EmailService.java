package com.iceguard.service;

import com.iceguard.model.AlertEvent;
import com.iceguard.model.AlertRule;
import com.iceguard.model.SmtpConfig;
import com.iceguard.repository.SmtpConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class EmailService {

    private static final Logger LOG = Logger.getLogger(EmailService.class);

    @Inject
    SmtpConfigRepository smtpConfigRepository;

    /**
     * Sends an alert notification email.
     * Currently logs the alert. TODO: Integrate JavaMail for actual SMTP sending.
     *
     * @param rule  the alert rule that was triggered
     * @param event the alert event with current values
     * @param recipients list of email addresses to notify
     */
    public void sendAlertNotification(AlertRule rule, AlertEvent event, List<String> recipients) {
        Optional<SmtpConfig> configOpt = smtpConfigRepository.findFirst();

        if (configOpt.isEmpty() || !configOpt.get().enabled) {
            LOG.infof("[ALERT EMAIL - SMTP NOT CONFIGURED] Rule '%s' triggered. " +
                            "Metric: %s, Value: %.2f, Threshold: %.2f (%s). Table: %s. Recipients: %s",
                    rule.name, event.metric, event.currentValue, event.threshold,
                    event.operator, event.tableRef, String.join(", ", recipients));
            return;
        }

        SmtpConfig smtp = configOpt.get();

        // TODO: Implement JavaMail integration
        // Properties props = new Properties();
        // props.put("mail.smtp.host", smtp.host);
        // props.put("mail.smtp.port", String.valueOf(smtp.port));
        // props.put("mail.smtp.auth", "true");
        // props.put("mail.smtp.starttls.enable", String.valueOf(smtp.tls));
        // Session session = Session.getInstance(props, new Authenticator() { ... });
        // MimeMessage message = new MimeMessage(session);
        // message.setFrom(new InternetAddress(smtp.fromAddress));
        // for (String recipient : recipients) {
        //     message.addRecipient(Message.RecipientType.TO, new InternetAddress(recipient));
        // }
        // message.setSubject("[IceGuard Alert] " + rule.name + " - " + event.status);
        // message.setText(buildEmailBody(rule, event));
        // Transport.send(message);

        LOG.infof("[ALERT EMAIL] Would send via %s:%d from %s. Rule '%s' triggered. " +
                        "Metric: %s, Value: %.2f, Threshold: %.2f (%s). Table: %s. Recipients: %s",
                smtp.host, smtp.port, smtp.fromAddress,
                rule.name, event.metric, event.currentValue, event.threshold,
                event.operator, event.tableRef, String.join(", ", recipients));
    }
}
