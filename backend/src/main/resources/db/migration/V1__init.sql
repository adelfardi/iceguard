CREATE TABLE catalog_config (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    uri VARCHAR(1024) NOT NULL,
    warehouse VARCHAR(1024),
    properties JSONB DEFAULT '{}',
    auth_type VARCHAR(50) DEFAULT 'NONE',
    credentials JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_schedule (
    id BIGSERIAL PRIMARY KEY,
    catalog_id BIGINT NOT NULL REFERENCES catalog_config(id) ON DELETE CASCADE,
    namespace VARCHAR(512),
    table_name VARCHAR(512),
    action_type VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    next_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE execution_history (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT REFERENCES maintenance_schedule(id) ON DELETE SET NULL,
    catalog_id BIGINT NOT NULL REFERENCES catalog_config(id) ON DELETE CASCADE,
    namespace VARCHAR(512) NOT NULL,
    table_name VARCHAR(512) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    result JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_history_catalog ON execution_history(catalog_id);
CREATE INDEX idx_execution_history_status ON execution_history(status);
CREATE INDEX idx_execution_history_started ON execution_history(started_at DESC);
CREATE INDEX idx_maintenance_schedule_catalog ON maintenance_schedule(catalog_id);
