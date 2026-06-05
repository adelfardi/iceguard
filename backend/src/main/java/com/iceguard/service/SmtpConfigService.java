package com.iceguard.service;

import com.iceguard.dto.request.SaveSmtpConfigRequest;
import com.iceguard.dto.response.SmtpConfigResponse;
import com.iceguard.model.SmtpConfig;
import com.iceguard.repository.SmtpConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.util.Optional;

@ApplicationScoped
public class SmtpConfigService {

    private static final Logger LOG = Logger.getLogger(SmtpConfigService.class);

    @Inject
    SmtpConfigRepository repository;

    public SmtpConfigResponse get() {
        Optional<SmtpConfig> configOpt = repository.findFirst();
        return configOpt.map(this::toResponse).orElse(null);
    }

    @Transactional
    public SmtpConfigResponse save(SaveSmtpConfigRequest request) {
        Optional<SmtpConfig> existing = repository.findFirst();
        SmtpConfig config;

        if (existing.isPresent()) {
            config = existing.get();
        } else {
            config = new SmtpConfig();
        }

        config.host = request.host();
        config.port = request.port();
        config.username = request.username();
        config.password = request.password();
        config.fromAddress = request.fromAddress();
        config.tls = request.tls();
        config.enabled = request.enabled();

        if (existing.isEmpty()) {
            repository.persist(config);
        }

        return toResponse(config);
    }

    public boolean testConnection() {
        Optional<SmtpConfig> configOpt = repository.findFirst();
        if (configOpt.isEmpty()) {
            return false;
        }

        SmtpConfig config = configOpt.get();

        // TODO: Implement actual SMTP connection test via JavaMail
        // try {
        //     Properties props = new Properties();
        //     props.put("mail.smtp.host", config.host);
        //     props.put("mail.smtp.port", String.valueOf(config.port));
        //     props.put("mail.smtp.auth", "true");
        //     props.put("mail.smtp.starttls.enable", String.valueOf(config.tls));
        //     props.put("mail.smtp.connectiontimeout", "5000");
        //     props.put("mail.smtp.timeout", "5000");
        //     Session session = Session.getInstance(props);
        //     Transport transport = session.getTransport("smtp");
        //     transport.connect(config.host, config.port, config.username, config.password);
        //     transport.close();
        //     return true;
        // } catch (Exception e) {
        //     LOG.warnf("SMTP connection test failed: %s", e.getMessage());
        //     return false;
        // }

        LOG.infof("SMTP connection test requested for %s:%d (test not implemented yet)", config.host, config.port);
        return config.host != null && !config.host.isBlank();
    }

    private SmtpConfigResponse toResponse(SmtpConfig config) {
        return new SmtpConfigResponse(
                config.id,
                config.host,
                config.port,
                config.username,
                config.fromAddress,
                config.tls,
                config.enabled,
                config.updatedAt
        );
    }
}
